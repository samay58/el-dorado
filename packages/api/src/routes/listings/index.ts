import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma, ListingRaw, Score, Site, PrismaClient } from '@my-real-estate-app/db';
import { GetListingsRequestQuerySchema, GetListingsRequestQuery, ListingApiResponseItem, GetListingsResponseSchema, ListingJsonDataSchema } from './schemas';
import { ZodError } from 'zod';

// Helper to roughly parse JSON fields for filtering/sorting if they are not top-level
// This is a simplified example. For production, consider database views or pre-extracted fields.
function getJsonFieldValue(json: Prisma.JsonValue, path: string): any {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return undefined;
  const parts = path.split('.');
  let current: any = json;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
}

export default async function listingsRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.get(
    '/listings',
    {
      schema: {
        querystring: GetListingsRequestQuerySchema,
        response: {
          200: GetListingsResponseSchema,
          // TODO: Add error response schemas (400 for validation, 500 for server errors)
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: GetListingsRequestQuery }>, reply: FastifyReply) => {
      const { page, limit, sortBy, sortOrder, minPrice, maxPrice, minBeds, minBaths, minSqft, maxSqft } = request.query as any;
      const prisma = fastify.prisma;

      try {
        const whereConditions: Prisma.ListingRawWhereInput[] = [];
        const orderBy: Prisma.ListingRawOrderByWithRelationInput[] = [];

        // Build Filter Conditions
        const pricePaths = ['listPrice', 'property_price', 'price'];
        const bedPaths = ['bedrooms', 'bedroom_count', 'beds'];
        const bathPaths = ['bathrooms', 'bathroom_count', 'baths'];
        const sqftPaths = ['livingArea', 'property_sqft', 'lotAreaValue'];

        if (minPrice !== undefined) {
          whereConditions.push({ OR: pricePaths.map(p => ({ json: { path: [p], gte: minPrice } })) });
        }
        if (maxPrice !== undefined) {
          whereConditions.push({ OR: pricePaths.map(p => ({ json: { path: [p], lte: maxPrice } })) });
        }
        if (minBeds !== undefined) {
          whereConditions.push({ OR: bedPaths.map(p => ({ json: { path: [p], gte: minBeds } })) });
        }
        if (minBaths !== undefined) {
          whereConditions.push({ OR: bathPaths.map(p => ({ json: { path: [p], gte: minBaths } })) });
        }
        if (minSqft !== undefined) {
          whereConditions.push({ OR: sqftPaths.map(p => ({ json: { path: [p], gte: minSqft } })) });
        }
        if (maxSqft !== undefined) {
          whereConditions.push({ OR: sqftPaths.map(p => ({ json: { path: [p], lte: maxSqft } })) });
        }

        const prismaWhere: Prisma.ListingRawWhereInput = whereConditions.length > 0 ? { AND: whereConditions } : {};

        // Build OrderBy Conditions
        if (sortBy === 'alignmentScore') {
          orderBy.push({ score: { [sortBy]: sortOrder } });
        } else {
          orderBy.push({ [sortBy]: sortOrder });
        }

        const totalListings = await prisma.listingRaw.count({ where: prismaWhere });
        const listingsWithScores = await prisma.listingRaw.findMany({
          where: prismaWhere,
          include: {
            score: true, // Include the related score data
          },
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        });

        // Transform data to API response shape
        const responseListings: ListingApiResponseItem[] = listingsWithScores.map((listing: ListingRaw & { score: Score | null }) => {
          const rawJson: any = listing.json || {};

          // Derive commonly-used fields when ZenRows key names differ
          const derived: Record<string, unknown> = {
            listPrice: rawJson.listPrice ?? rawJson.price ?? rawJson.priceRaw ?? rawJson.property_price,
            address: rawJson.address?.streetAddress ?? rawJson.address ?? rawJson.streetAddress,
            bedrooms: rawJson.bedrooms ?? rawJson.beds ?? rawJson.bedroom_count,
            bathrooms: rawJson.bathrooms ?? rawJson.baths ?? rawJson.bathroom_count,
            livingArea: rawJson.livingArea ?? rawJson.lotAreaValue ?? rawJson.homedetails?.finishedSqFt ?? rawJson.property_sqft,
            latitude: rawJson.latitude ?? rawJson.latLong?.latitude,
            longitude: rawJson.longitude ?? rawJson.latLong?.longitude,
            propertyType: rawJson.propertyType ?? rawJson.homeType ?? rawJson.property_type,
            property_image: (
              rawJson.property_image ??
              rawJson.photo_image ??
              rawJson.imgSrc ??
              rawJson.image ??
              (Array.isArray(rawJson.images) && (rawJson.images[0]?.url || rawJson.images[0])) ??
              (Array.isArray(rawJson.photos) && (rawJson.photos[0]?.url || rawJson.photos[0]))
            ),
          };

          const jsonDataValidated = ListingJsonDataSchema.parse({ ...rawJson, ...derived });

          return {
            extId: listing.extId,
            site: listing.site as Site,
            url: listing.url,
            capturedAt: listing.capturedAt,
            jsonData: jsonDataValidated,
            scoreData: listing.score ? {
              alignmentScore: listing.score.alignmentScore,
              missingMusts: listing.score.missingMusts,
              matchedCriteriaKeys: listing.score.matchedCriteriaKeys,
              locationBonus: listing.score.locationBonus,
              scoredAt: listing.score.scoredAt,
            } : undefined,
          };
        });

        return reply.send({
          listings: responseListings,
          totalListings,
          totalPages: Math.ceil(totalListings / limit),
          currentPage: page,
          limit,
        });

      } catch (error) {
        if (error instanceof ZodError) {
          fastify.log.error(error, 'Validation error for /listings request');
          return reply.status(400).send({ message: 'Validation Error', errors: error.flatten().fieldErrors });
        }
        fastify.log.error(error, 'Error fetching listings');
        return reply.status(500).send({ message: 'Internal Server Error' });
      }
    }
  );

  // Get single listing by extId
  fastify.get('/listings/:extId', async (req, reply) => {
    const { extId } = req.params as { extId: string };
    const listing = await fastify.prisma.listingRaw.findUnique({
      where: { extId_site: { extId, site: 'ZILLOW' } },
      include: { score: true },
    });
    if (!listing) return reply.status(404).send({ message: 'Not found' });

    const rawJson: any = listing.json || {};
    const derived = {
      listPrice: rawJson.listPrice ?? rawJson.property_price ?? rawJson.price,
      address: rawJson.address,
      bedrooms: rawJson.bedrooms ?? rawJson.bedroom_count,
      bathrooms: rawJson.bathrooms ?? rawJson.bathroom_count,
      livingArea: rawJson.livingArea ?? rawJson.property_sqft,
      property_image: (
        rawJson.property_image ??
        rawJson.photo_image ??
        rawJson.imgSrc ??
        rawJson.image ??
        (Array.isArray(rawJson.images) && (rawJson.images[0]?.url || rawJson.images[0])) ??
        (Array.isArray(rawJson.photos) && (rawJson.photos[0]?.url || rawJson.photos[0]))
      ),
    };

    return reply.send({
      extId: listing.extId,
      url: listing.url,
      capturedAt: listing.capturedAt,
      jsonData: { ...rawJson, ...derived },
      scoreData: listing.score ?? undefined,
    });
  });
} 