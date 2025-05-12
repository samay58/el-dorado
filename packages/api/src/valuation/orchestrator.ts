// Nightly valuation job orchestrator 
import { PrismaClient, Site } from '@my-real-estate-app/db';
import pMap from 'p-map'; // For concurrent processing
import { v4 as uuidv4 } from 'uuid'; // For generating job_run_id

import { ZILLOW_BULK_REQUEST_SIZE } from './config';
import { fetchZillowDataForZpids, ZillowExtract } from './extractors/zillow';
import { deriveZillowSignals, DerivedSignals } from './signals/zillowDerived';
import { fetchRedfinSignals, RedfinSignals } from './signals/redfin';
import { computeValue, AllSignals, ValueComputationResult } from './math/compute';

const prisma = new PrismaClient();

const NOTIFY_VALUE_CHANGE_THRESHOLD = 0.1;

interface ListingToProcess {
  extId: string;
  site: Site;
  url: string; // For logging or if needed by signal extractors
  // Add other fields from ListingRaw if necessary for signal generation (e.g., address components)
  address?: any; // Placeholder, refine based on actual schema if address parts are needed
}

// Type for items coming from the initial Prisma query
interface RawListingQueryResult {
  extId: string;
  site: Site; // Prisma enums are generally well-typed
  url: string;
  // json?: any; // If json was selected
}

export async function runValuationJob() {
  const jobRunId = uuidv4();
  console.log(`Starting valuation job, run ID: ${jobRunId}`);
  try {
    await prisma.etlError.create({
      data: {
        id: jobRunId,
        source: 'ValuationJob',
        message: 'Valuation job started',
        resolved: false, // Mark as unresolved until completion
      },
    });

    // 1. Fetch ListingRaw entries that don't yet have a corresponding Valuation record.
    const listingsToProcessDb = await prisma.listingRaw.findMany({
      where: {
        valuation: null, // Only process listings without a valuation
        // Potentially add other filters, e.g., only for specific sites if needed
        // site: Site.ZILLOW, 
      },
      select: {
        extId: true,
        site: true,
        url: true,
        // Select address components if needed by signal extractors like HouseCanary/ATTOM
        // json: true, // If address is buried in the raw JSON and not a top-level field
      },
      // take: 100, // Optional: Limit the number of listings processed per run for testing/throttling
    });

    if (listingsToProcessDb.length === 0) {
      console.log('No listings found to valuate.');
      await prisma.etlError.update({
        where: { id: jobRunId },
        data: { message: 'Valuation job finished: No listings to process', resolved: true },
      });
      return;
    }

    console.log(`Found ${listingsToProcessDb.length} listings to valuate.`);

    // Map to the structure needed for processing, potentially extracting address from JSON if complex
    const listingsToProcess: ListingToProcess[] = listingsToProcessDb.map((l: RawListingQueryResult) => ({
      extId: l.extId,
      site: l.site,
      url: l.url,
      // address: l.json?.address // Example: extract address if it lives in the JSON blob
    }));

    // 2. Process listings in batches using p-map for Zillow data extraction
    // For now, Zillow is the only extractor. If others are added, this might change.
    const zillowListings = listingsToProcess.filter(l => l.site === Site.ZILLOW);
    // Other site listings would need their own extractors.

    const mapper = async (listingChunk: ListingToProcess[]) => {
      const zpidsToFetch = listingChunk.map(l => l.extId);
      const zillowExtracts = await fetchZillowDataForZpids(zpidsToFetch);

      for (const extract of zillowExtracts) {
        if (!extract || extract.rawResponse?.error) {
          console.warn(`Skipping ZPID ${extract.zpid} due to fetch error or no data.`);
          await prisma.etlError.create({
            data: {
              source: 'ValuationJobZillowExtract',
              message: `Failed to extract Zillow data for ZPID: ${extract.zpid}`,
              details: extract.rawResponse?.error || 'No data returned',
              resolved: false, 
            }
          });
          continue;
        }

        const originalListing = listingChunk.find(l => l.extId === extract.zpid);
        if (!originalListing) continue;

        const derivedZillowSignals = deriveZillowSignals(extract);
        
        // const addressString = originalListing.address?.street; 
        // const zipString = extract.zip || originalListing.address?.zipcode;

        const redfinSignals = await fetchRedfinSignals(extract.zpid); // Still a stub
        // const hcSignals = addressString && zipString ? await fetchHouseCanarySignals(addressString, zipString) : undefined;
        // const attomSignals = addressString && zipString ? await fetchAttomSignals(addressString, zipString) : undefined;

        const allSignals: AllSignals = {
          ...derivedZillowSignals,
          ...redfinSignals,
          // ...hcSignals, // Removed
          // ...attomSignals, // Removed
        };

        const valuationResult = computeValue(allSignals);

        const valuationData = {
          listingExtId: extract.zpid,
          site: originalListing.site,
          signals: allSignals, 
          valueIndex: valuationResult.valueIndex,
          rawScore: valuationResult.rawScore,
          calculatedAt: new Date(),
        };

        await prisma.valuation.upsert({
          where: { listingExtId_site: { listingExtId: extract.zpid, site: originalListing.site } },
          update: valuationData,
          create: valuationData,
        });
        console.log(`Valuated ZPID: ${extract.zpid}, Value Index: ${valuationResult.valueIndex}`);
      }
    };

    // Chunk Zillow listings for batch processing
    const zillowListingChunks: ListingToProcess[][] = [];
    for (let i = 0; i < zillowListings.length; i += ZILLOW_BULK_REQUEST_SIZE) {
      zillowListingChunks.push(zillowListings.slice(i, i + ZILLOW_BULK_REQUEST_SIZE));
    }

    await pMap(zillowListingChunks, mapper, { concurrency: 2 }); // Adjust concurrency as needed

    await prisma.etlError.update({
      where: { id: jobRunId },
      data: { message: `Valuation job finished successfully. Processed ${zillowListings.length} Zillow listings.`, resolved: true },
    });
    console.log(`Valuation job completed, ID: ${jobRunId}`);

  } catch (error: any) {
    console.error(`Valuation job failed (ID: ${jobRunId}):`, error);
    await prisma.etlError.update({
      where: { id: jobRunId },
      data: {
        message: `Valuation job failed: ${error.message}`,
        details: { stack: error.stack, error: String(error) },
        resolved: false, // Mark as unresolved, needs investigation
      },
    }).catch((err: any) => console.error("Failed to update EtlError on job failure:", err)); // Prevent error in error logging from crashing
  }
}

// Example of how to run this job (e.g., from a script or a scheduled task runner)
// if (require.main === module) {
//   console.log("Running valuation job directly...");
//   runValuationJob()
//     .then(() => console.log("Job run finished."))
//     .catch(e => console.error("Job run failed with error:", e))
//     .finally(async () => {
//       await prisma.$disconnect();
//     });
// } 