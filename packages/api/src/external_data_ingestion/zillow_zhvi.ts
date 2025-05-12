// packages/api/src/external_data_ingestion/zillow_zhvi.ts

/**
 * Represents Zillow Home Value Index (ZHVI) data for a ZIP code.
 */
export interface ZillowZhviData {
  zipCode: string;
  regionName: string; // e.g., "94110, CA"
  month: Date;
  zhvi?: number; // Typical home value
  zhviAppreciation12Mo?: number; // 12-month % appreciation, needs calculation if Zillow provides raw values over time
  // Add other relevant fields from Zillow research data
}

/**
 * Fetches Zillow ZHVI data (e.g., from a downloaded CSV), parses it,
 * and stores it in the database.
 * This function would be called by a scheduled job.
 */
export async function ingestZillowZhvi(): Promise<void> {
  console.log('Ingesting Zillow ZHVI data - STUB');
  // 1. Define CSV/data source from Zillow Research (https://www.zillow.com/research/data/).
  // 2. Fetch/read the data file.
  // 3. Parse data.
  // 4. For each relevant row/region (filter for SF zips if national file), transform to ZillowZhviData.
  //    Calculate 12-month appreciation if necessary.
  // 5. Upsert into a new Prisma model (e.g., ZillowZhviZip).
  console.log('Zillow ZHVI data ingestion stub complete.');
} 