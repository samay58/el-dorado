import Fastify, { FastifyInstance, FastifyRequest } from 'fastify';
import sensible from '@fastify/sensible'; // Though not explicitly listed, it's good for error handling
import cors from '@fastify/cors';
import fastifyEnv from '@fastify/env';
import { z, ZodError } from 'zod'; // Import ZodError for error handling
import axios from 'axios'; // Added axios
import { PrismaClient, EtlError, Site } from '@my-real-estate-app/db'; // Import Prisma Client, EtlError type, and Site enum
import crypto from 'crypto'; // For crypto.randomUUID()
import { ZodTypeProvider, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

// Import scoring functions
import { loadAndPrepareCriteria, scoreListing, ListingScoreV2, PreparedCriterion } from './scoring';
// Import listings routes
import listingsRoutes from './routes/listings'; // Adjusted path assuming index.ts in routes/listings

const prisma = new PrismaClient(); // Instantiate Prisma Client

// Define the schema for environment variables
const envSchema = {
  type: 'object',
  required: ['PORT', 'ZENROWS_API_KEY'], // SCRAPE_MAX_ENDPOINT_CALLS is optional with sane default
  properties: {
    PORT: { type: 'string', default: '3001' },
    HOST: { type: 'string', default: '0.0.0.0' },
    ZENROWS_API_KEY: { type: 'string' },
    SCRAPE_MAX_ENDPOINT_CALLS: { type: 'string', default: '1' },
  },
} as const;

// Declare a module augmentation for FastifyInstance to include our custom env types
declare module 'fastify' {
  interface FastifyInstance {
    config: {
      PORT: string;
      HOST: string;
      ZENROWS_API_KEY: string;
      SCRAPE_MAX_ENDPOINT_CALLS: string;
    };
    prisma: PrismaClient; // Add prisma decorator type
  }
}

// Define Zod schema for scrape route parameters
const scrapeParamsSchema = z.object({
  mode: z.enum(['buy', 'rent']),
  site: z.enum(['zillow', 'trulia']),
});
// Define a type for the validated params for cleaner use in the handler
type ScrapeParams = z.infer<typeof scrapeParamsSchema>;

// In-memory counters for testing limits
let zenRowsEndpointCallCount = 0;
let MAX_ENDPOINT_CALLS = 1; // Will be overridden by env in buildServer()
const MAX_ZPIDS_TO_PROCESS_PER_DISCOVERY = Number.MAX_SAFE_INTEGER; // Process all discovered ZPIDs

// Helper function to log errors to DB
async function logErrorToDb(source: string, message: string, details?: object | string) {
  try {
    await prisma.etlError.create({
      data: {
        source,
        message,
        details: details ? JSON.parse(JSON.stringify(details)) : undefined, // Ensure details is valid JSON
        // timestamp and resolved have defaults in schema
      },
    });
    console.log(`[DB_LOG] Error logged to EtlError table. Source: ${source}`);
  } catch (dbError) {
    console.error('[DB_LOG_FAIL] Failed to log error to EtlError table:', dbError);
    console.error('[DB_LOG_FAIL] Original error was:', { source, message, details });
  }
}

// Build Fastify server configured with Zod type provider.
// Let TypeScript infer the exact generic parameters instead of forcing the default ones
// (this avoids the mismatch seen during DTS generation).
const buildServer = async () => {
  console.log('[DEBUG] Entering buildServer...');
  const server = Fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  }).withTypeProvider<ZodTypeProvider>();

  // Add Zod serializer and validator compilers
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);

  // Decorate with Prisma client
  server.decorate('prisma', prisma);

  // Register plugins
  await server.register(fastifyEnv, {
    confKey: 'config', // Access environment variables via server.config
    schema: envSchema,
    dotenv: true, // Load .env file if present
  });

  // Register sensible for better error handling and utility functions
  await server.register(sensible);

  // Register CORS
  await server.register(cors, {
    origin: '*', // Configure this more restrictively for production
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Health check route
  server.get('/', async (_request, reply) => {
    return reply.send({ status: 'ok', message: 'API is running' });
  });

  // Register application routes
  await server.register(listingsRoutes, { prefix: '/api' }); // Register listings routes under /api

  // POST /api/process-scores route
  server.post('/api/process-scores', async (request, reply) => {
    const BATCH_SIZE = 10; // Process 10 listings at a time, configurable
    const operationSource = 'process_scores_job';
    server.log.info(`[${operationSource}] Starting job. Batch size: ${BATCH_SIZE}`);

    try {
      const preparedCriteria: PreparedCriterion[] = await loadAndPrepareCriteria(prisma);

      if (preparedCriteria.length === 0) {
        server.log.warn(`[${operationSource}] No criteria loaded or prepared. Aborting scoring process.`);
        return reply.status(400).send({ status: 'error', message: 'No scoring criteria available/prepared.' });
      }
      server.log.info(`[${operationSource}] Successfully loaded and prepared ${preparedCriteria.length} criteria.`);

      const unscoredListings = await prisma.listingRaw.findMany({
        where: {
          score: null,
        },
        take: BATCH_SIZE,
      });

      if (unscoredListings.length === 0) {
        server.log.info(`[${operationSource}] No unscored listings found to process.`);
        return reply.send({ status: 'success', message: 'No unscored listings to process.', processedCount: 0 });
      }

      server.log.info(`[${operationSource}] Found ${unscoredListings.length} unscored listings to process.`);
      let processedCount = 0;
      let errorCount = 0;
      const errors: { listingExtId: string, error: string, details?: any }[] = [];

      for (const listing of unscoredListings) {
        const listingSource = `${operationSource}_listing_${listing.extId}`;
        try {
          // Ensure listing.json is valid and has expected structure for scoring
          if (!listing.json || typeof listing.json !== 'object') {
            server.log.warn(`[${listingSource}] Listing JSON is missing or not an object. Skipping.`);
            await logErrorToDb(listingSource, 'Listing JSON missing or invalid format', { listingId: listing.id, extId: listing.extId });
            errors.push({ listingExtId: listing.extId, error: 'Listing JSON missing or invalid format' });
            errorCount++;
            continue;
          }

          // Type assertion for listing.json if you have a specific type, otherwise 'any' is used by scoreListing
          const scoreResult: ListingScoreV2 = scoreListing(listing.json, preparedCriteria);

          await prisma.score.create({
            data: {
              listingExtId: listing.extId,
              site: listing.site as Site, // Add the site from the ListingRaw object
              alignmentScore: scoreResult.alignmentScore,
              missingMusts: scoreResult.missingMusts,
              matchedCriteriaKeys: scoreResult.matchedCriteriaKeys,
              partials: scoreResult.detailedHits, // This should align with the Json? type in Score model
              locationBonus: scoreResult.locationBonus,
              // scoredAt is set by default via @default(now()) and @updatedAt
            },
          });
          server.log.info(`[${listingSource}] Successfully scored and saved. Score: ${scoreResult.alignmentScore}, Location Bonus: ${scoreResult.locationBonus}`);
          processedCount++;
        } catch (scoreError: any) {
          server.log.error(`[${listingSource}] Error scoring listing: ${scoreError.message}`, { error: scoreError });
          await logErrorToDb(listingSource, `Error scoring listing ${listing.extId}: ${scoreError.message}`, { listingId: listing.id, errorDetails: scoreError.stack });
          errors.push({ listingExtId: listing.extId, error: scoreError.message, details: scoreError.stack?.substring(0, 300) });
          errorCount++;
        }
      }

      server.log.info(`[${operationSource}] Job finished. Processed: ${processedCount}, Errors: ${errorCount}`);
      return reply.send({
        status: 'success',
        message: `Scoring job finished. Processed: ${processedCount}, Errors: ${errorCount}`,
        processedCount,
        errorCount,
        errors: errorCount > 0 ? errors : undefined,
      });

    } catch (jobError: any) {
      server.log.error(`[${operationSource}] Unhandled error during scoring job: ${jobError.message}`, { error: jobError });
      await logErrorToDb(operationSource, `Unhandled error in scoring job: ${jobError.message}`, { errorDetails: jobError.stack });
      if (!reply.sent) {
        return reply.status(500).send({ status: 'error', message: 'Internal server error during scoring process.' });
      }
    }
  });

  // Updated Scrape route with ZenRows call
  server.get('/scrape/:mode/:site', async (request: FastifyRequest<{ Params: unknown }>, reply) => {
    let scrapeRun: { id: string } | null = null;
    try {
      const params = scrapeParamsSchema.parse(request.params) as ScrapeParams;
      const { mode, site } = params;
      const mainOperationSource = `scrape_job_${site}_${mode}`;
      const apiKey = server.config.ZENROWS_API_KEY;
      let processedPropertyCount = 0;
      const processedZpids: string[] = [];
      const errorsProcessingZpids: { zpid: string, error: string, details?: any }[] = [];

      if (site === 'zillow') {
        // --- Dedup / Lock handling ---
        const now = new Date();
        const THIRTY_MIN_MS = 30 * 60 * 1000;
        const recentInProgress = await prisma.scrapeRun.findFirst({
          where: {
            site: Site.ZILLOW,
            mode,
            status: {
              equals: 'IN_PROGRESS',
            },
            startedAt: {
              gte: new Date(now.getTime() - THIRTY_MIN_MS),
            },
          },
        });

        if (recentInProgress) {
          server.log.warn(`Abort: existing Zillow scrape run in progress (started ${recentInProgress.startedAt.toISOString()}).`);
          return reply.status(429).send({
            status: 'error',
            message: 'A Zillow scrape run is already in progress. Try again later.',
          });
        }

        scrapeRun = await prisma.scrapeRun.create({
          data: {
            site: Site.ZILLOW,
            mode,
            status: 'IN_PROGRESS',
          },
        });
        // We will update this ScrapeRun record on completion/failure

        server.log.info(`Zillow scrape initiated for mode: ${mode}. Endpoint call: ${zenRowsEndpointCallCount + 1}/${MAX_ENDPOINT_CALLS}`);
        
        let zillowSearchUrl = '';
        if (mode === 'buy') {
          // Using a simpler Zillow URL for testing the ZenRows Discovery API
          zillowSearchUrl = "https://www.zillow.com/homes/for_sale/San-Francisco,-CA/";
          server.log.info(`Using simplified Zillow 'buy' URL for Discovery test: ${zillowSearchUrl}`);
        } else { // mode === 'rent'
          zillowSearchUrl = "https://www.zillow.com/homes/for_rent/San-Francisco,-CA/";
          server.log.warn(`Using simplified Zillow 'rent' URL for Discovery test: ${zillowSearchUrl}`);
        }

        const discoveryApiUrl = `https://realestate.api.zenrows.com/v1/targets/zillow/discovery/`;
        
        server.log.info(`Calling ZenRows Zillow Discovery API...`);
        let discoveryResponse;
        try {
          discoveryResponse = await axios.get(discoveryApiUrl, {
            params: { apikey: apiKey, url: zillowSearchUrl }, // Sending the simplified URL
            timeout: 180000,
          });
        } catch (axiosError: any) {
          // Log Axios error for Discovery API to DB before re-throwing or handling
          const errorDetails = { 
            message: axiosError.message, 
            url: axiosError.config?.url,
            target_url: zillowSearchUrl,
            response_status: axiosError.response?.status,
            response_data_snippet: JSON.stringify(axiosError.response?.data)?.substring(0, 200)
          };
          await logErrorToDb(`${mainOperationSource}_discovery_axios_error`, `Axios error during Zillow Discovery: ${axiosError.message}`, errorDetails);
          throw axiosError; // Re-throw to be caught by the main try-catch which will send HTTP response
        }

        // Increment endpoint call count only after the first ZenRows call (Discovery) is successful
        zenRowsEndpointCallCount++; 
        server.log.info(`ZenRows Zillow Discovery call successful. Endpoint call count: ${zenRowsEndpointCallCount}/${MAX_ENDPOINT_CALLS}`);
        // server.log.info(`Discovery Response (full): ${JSON.stringify(discoveryResponse.data)}`); // Careful: can be very large

        const propertyList = discoveryResponse.data?.property_list;
        if (!propertyList || !Array.isArray(propertyList) || propertyList.length === 0) {
          server.log.warn('No properties found in Zillow Discovery or list is empty.', { dataPreview: JSON.stringify(discoveryResponse.data).substring(0, 500) });
          await logErrorToDb(`${mainOperationSource}_discovery_no_properties`, 'No properties found or list empty after Zillow Discovery call', {responseDataPreview: JSON.stringify(discoveryResponse.data).substring(0,500)});
          return reply.send({ status: 'success', message: 'Zillow Discovery ran, but no properties found matching criteria.', params, discovery_data_preview: JSON.stringify(discoveryResponse.data).substring(0,1000) });
        }

        server.log.info(`Discovered ${propertyList.length} initial properties. Will process all of them.`);
        
        const zpidsToProcess = propertyList
          .map((item: any) => item.property_url?.match(/(\d+)_zpid\/?$/)?.[1])
          .filter(Boolean); // Remove any undefined/null ZPIDs – no slice, process all

        if (zpidsToProcess.length === 0) {
          server.log.warn('No ZPIDs could be extracted from the discovered properties.');
          await logErrorToDb(`${mainOperationSource}_discovery_no_zpids`, 'No ZPIDs extractable from discovered properties');
          return reply.send({ status: 'success', message: 'Zillow Discovery ran, properties found, but no ZPIDs extractable for processing.', params });
        }

        server.log.info(`Extracted ${zpidsToProcess.length} ZPIDs to process: ${zpidsToProcess.join(', ')}`);

        // Loop through ZPIDs and call Property Data API
        for (const zpid of zpidsToProcess) {
          const zpidSource = `${mainOperationSource}_property_zpid_${zpid}`;
          try {
            server.log.info(`Fetching property details for ZPID: ${zpid}`);
            const propertyApiUrl = `https://realestate.api.zenrows.com/v1/targets/zillow/properties/${zpid}`;
            const propertyResponse = await axios.get(propertyApiUrl, {
              params: { apikey: apiKey, country: 'us' }, // country=us is optional but good practice
              timeout: 120000, // Timeout for individual property fetch
            });

            const propertyData = propertyResponse.data;
            if (propertyData && typeof propertyData === 'object') {
              server.log.info(`Successfully fetched details for ZPID: ${zpid}. Address: ${propertyData.address}`);
              
              // Save to ListingRaw table
              await prisma.listingRaw.upsert({
                where: { extId_site: { extId: zpid, site: Site.ZILLOW } }, // Corrected where clause
                update: {
                  source: 'zillow_property_api',
                  site: Site.ZILLOW, // Explicitly set site
                  url: propertyData.property_url || `https://www.zillow.com/homedetails/${zpid}_zpid/`,
                  capturedAt: new Date(),
                  json: propertyData, // Store the full JSON response from Property Data API
                },
                create: {
                  id: crypto.randomUUID(), // Generate UUID for new entries
                  extId: zpid,
                  source: 'zillow_property_api',
                  site: Site.ZILLOW, // Explicitly set site
                  url: propertyData.property_url || `https://www.zillow.com/homedetails/${zpid}_zpid/`,
                  capturedAt: new Date(),
                  json: propertyData,
                },
              });
              server.log.info(`Saved/Updated details for ZPID: ${zpid} to database.`);
              processedPropertyCount++;
              processedZpids.push(zpid);
            } else {
              server.log.warn(`No data or unexpected data format for ZPID: ${zpid}`, { data: propertyData });
              const errDetails = { zpid, responseData: propertyData };
              await logErrorToDb(`${zpidSource}_no_data`, 'No data or unexpected format from Property API', errDetails);
              errorsProcessingZpids.push({ zpid, error: "No data or unexpected format from Property API", details: errDetails });
            }
          } catch (propError: any) {
            server.log.error(`Failed to fetch or save property details for ZPID: ${zpid}`, { error: propError.message });
            const errDetails = { zpid, errorMessage: propError.message, stack: propError.stack?.substring(0,500) };
            await logErrorToDb(`${zpidSource}_save_error`, `Failed to save property details for ZPID ${zpid}: ${propError.message}`, errDetails);
            errorsProcessingZpids.push({ zpid, error: `DB Save Error: ${propError.message}`, details: errDetails });
            if (axios.isAxiosError(propError)) {
                server.log.error('Axios error details:', { status: propError.response?.status, data: propError.response?.data});
            }
          }
        }

        if (scrapeRun) {
          await prisma.scrapeRun.update({
            where: { id: scrapeRun.id },
            data: { status: 'SUCCESS', finishedAt: new Date() },
          });
        }

        return reply.send({
          status: 'success',
          message: `Zillow process complete. Discovered ${propertyList.length}. Processed ${processedPropertyCount} ZPIDs.`, 
          params,
          processed_zpids: processedZpids,
          errors_processing_zpids: errorsProcessingZpids,
          endpoint_calls_made_this_session: zenRowsEndpointCallCount,
        });

      } else if (site === 'trulia') {
        server.log.warn('Trulia scraping is not yet implemented.');
        return reply.status(501).send({ status: 'error', message: 'Trulia scraping not implemented' });
      } else {
        return reply.status(400).send({ status: 'error', message: 'Invalid site specified' });
      }

    } catch (error: any) {
      const validatedParams = (request.params && typeof request.params === 'object' && 'site' in request.params && 'mode' in request.params) 
                              ? request.params as { site: string, mode: string } 
                              : { site: 'unknown', mode: 'unknown' };
      const errorSource = `scrape_job_${validatedParams.site}_${validatedParams.mode}_route_error`;
      let errorDetails: any = { message: error.message, stack: error.stack?.substring(0, 500) };

      if (error instanceof ZodError) {
        server.log.warn({ error: error.issues }, 'Invalid scrape parameters');
        errorDetails.zodIssues = error.issues;
        await logErrorToDb(errorSource + '_zod', 'Invalid scrape parameters', errorDetails);
        return reply.status(400).send({ status: 'error', message: 'Invalid parameters', details: error.issues });
      }
      if (axios.isAxiosError(error)) {
        errorDetails.url = error.config?.url;
        errorDetails.response_status = error.response?.status;
        errorDetails.response_data_snippet = JSON.stringify(error.response?.data)?.substring(0, 200);
        await logErrorToDb(errorSource + '_axios_unhandled', `Unhandled Axios error in scrape route: ${error.message}`, errorDetails);
        return reply.status(error.response?.status || 500).send({ 
          status: 'error', 
          message: 'Failed to fetch data from ZenRows', 
          details: error.message 
        });
      }
      server.log.error({ error }, 'Error in scrape route');
      if (scrapeRun) {
        try {
          await prisma.scrapeRun.update({
            where: { id: scrapeRun.id },
            data: { status: 'ERROR', finishedAt: new Date() },
          });
        } catch (updateErr) {
          server.log.error({ updateErr }, 'Failed to update ScrapeRun status to ERROR');
        }
      }
      await logErrorToDb(errorSource + '_generic', `Generic error in scrape route: ${error.message}`, errorDetails);
      return reply.status(500).send({ status: 'error', message: 'Internal server error' });
    }
  });

  // After env is loaded, set runtime MAX_ENDPOINT_CALLS
  MAX_ENDPOINT_CALLS = parseInt(server.config.SCRAPE_MAX_ENDPOINT_CALLS ?? '1', 10);
  if (Number.isNaN(MAX_ENDPOINT_CALLS) || MAX_ENDPOINT_CALLS < 1) {
    server.log.warn(`Invalid SCRAPE_MAX_ENDPOINT_CALLS env value (${server.config.SCRAPE_MAX_ENDPOINT_CALLS}); falling back to 1.`);
    MAX_ENDPOINT_CALLS = 1;
  }
  server.log.info(`Max ZenRows endpoint calls per server session set to ${MAX_ENDPOINT_CALLS}`);

  console.log('[DEBUG] buildServer finished, returning server instance.');
  return server;
};

const start = async () => {
  console.log('[DEBUG] Entering start function...');
  // Use the same (inferred) FastifyInstance type returned by buildServer to avoid generic mismatches.
  let server: Awaited<ReturnType<typeof buildServer>> | null = null;
  try {
    server = await buildServer();
    console.log('[DEBUG] Server instance built, attempting to listen...');
    await server.listen({ port: parseInt(server.config.PORT, 10), host: server.config.HOST });
    console.log('[DEBUG] server.listen awaited successfully.');
    server.log.info(`API server listening on http://${server.config.HOST}:${server.config.PORT}`);
    server.log.info(`ZenRows endpoint call limit set to ${MAX_ENDPOINT_CALLS}.`);
    server.log.info(`ZPID processing cap disabled – high cap set (${MAX_ZPIDS_TO_PROCESS_PER_DISCOVERY}).`);
  } catch (err) {
    console.error('[DEBUG] Error in start function:', err);
    if (server && server.log) {
      server.log.error(err, 'Error starting server');
    }
    process.exit(1);
  }
};

start(); 