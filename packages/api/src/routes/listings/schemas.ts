import { z } from 'zod';
import { Site } from '@my-real-estate-app/db'; // Assuming Site enum is exported from db package

// --- Request Schemas ---

export const ListingFiltersSchema = z.object({
  zipCode: z.string().optional(),
  minAlignmentScore: z.number().min(0).max(100).optional(),
  maxAlignmentScore: z.number().min(0).max(100).optional(),
  minBeds: z.number().int().min(0).optional(),
  minBaths: z.number().min(0).optional(), // Can be 0.5, 1.5 etc.
  minListPrice: z.number().min(0).optional(),
  maxListPrice: z.number().min(0).optional(),
  minLivingArea: z.number().min(0).optional(),
  maxLivingArea: z.number().min(0).optional(),
}).partial(); // All filters are optional

export const GetListingsRequestQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['capturedAt', 'alignmentScore']).default('capturedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),

  // Flat filter fields
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minBeds: z.coerce.number().int().min(0).optional(),
  minBaths: z.coerce.number().min(0).optional(),
  minSqft: z.coerce.number().min(0).optional(),
  maxSqft: z.coerce.number().min(0).optional(),
});

// --- Response Schemas ---

const ScoreDataSchema = z.object({
  alignmentScore: z.number(),
  missingMusts: z.array(z.string()),
  matchedCriteriaKeys: z.array(z.string()),
  locationBonus: z.number(),
  // partials: z.any().optional(), // If you want to include the detailed partials JSON
  scoredAt: z.date(),
});

export const ListingJsonDataSchema = z.object({
  // Define strictly what parts of ListingRaw.json are exposed
  // This is an EXAMPLE, adjust to your actual Zillow JSON structure from ZenRows
  listPrice: z.number().optional(),
  // Assuming address might be a string in some source data based on runtime error
  address: z.string().optional(), 
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  livingArea: z.number().optional(), // Square footage
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  propertyType: z.string().optional(),
  // Medium/primary photo URL
  property_image: z.string().url().optional(),
  // Add other commonly used fields: homeStatus, lotSize, yearBuilt etc.
});

export const ListingApiResponseItemSchema = z.object({
  extId: z.string(),
  site: z.nativeEnum(Site),
  url: z.string().url(),
  capturedAt: z.date(),
  jsonData: ListingJsonDataSchema, // Selected and typed fields from ListingRaw.json
  scoreData: ScoreDataSchema.optional(), // Score might not always be present if processing failed
});

export const GetListingsResponseSchema = z.object({
  listings: z.array(ListingApiResponseItemSchema),
  totalListings: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  limit: z.number().int(),
});

// Type for query parameters after validation
export type GetListingsRequestQuery = z.infer<typeof GetListingsRequestQuerySchema>;
// Type for a single listing item in the API response
export type ListingApiResponseItem = z.infer<typeof ListingApiResponseItemSchema>; 