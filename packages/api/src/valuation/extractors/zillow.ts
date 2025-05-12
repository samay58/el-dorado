import axios from 'axios';
import { ZILLOW_BULK_REQUEST_SIZE } from '../config'; // Assuming ZENROWS_API_KEY is in process.env

const ZENROWS_API_KEY = process.env.ZENROWS_API_KEY;
const ZENROWS_ZILLOW_PROPERTY_BASE_URL = 'https://api.zenrows.com/v1/'; // Base URL for ZenRows API

export interface PriceHistoryEvent {
  event: string;
  date: string;
  price: number;
  // Add other relevant fields from Zillow's price history if available
}

export interface ZillowExtract {
  zpid: string; // Make sure to include ZPID for identification
  listPrice?: number;
  zestimate?: number;
  daysOnSite?: number;
  priceHistory?: PriceHistoryEvent[];
  latitude?: number;
  longitude?: number;
  zip?: string;
  // Potentially add raw API response for debugging or future use
  rawResponse?: any; 
}

// Simple in-memory cache (can be replaced with a more robust LRU cache library)
const cache = new Map<string, { extract: ZillowExtract; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL for cache

/**
 * Fetches Zillow property data for a list of ZPIDs using ZenRows bulk endpoint.
 * 
 * TODO: Implement actual bulk fetching logic if ZenRows supports it for property details directly.
 * For now, this will fetch one by one but demonstrates the structure.
 * If ZenRows offers a /targets/zillow/properties bulk endpoint, adapt to that.
 * Otherwise, we might need to call /targets/zillow/properties/{zpid} individually or use their general-purpose scraper with batch URLs.
 */
export async function fetchZillowDataForZpids(zpids: string[]): Promise<ZillowExtract[]> {
  if (!ZENROWS_API_KEY) {
    console.error('ZENROWS_API_KEY is not configured.');
    throw new Error('ZenRows API key is missing.');
  }

  const results: ZillowExtract[] = [];
  const now = Date.now();

  // Process ZPIDs in chunks according to ZILLOW_BULK_REQUEST_SIZE (if using a true bulk endpoint)
  // For individual calls, this loop structure is still fine.
  for (const zpid of zpids) {
    // Check cache first
    const cachedEntry = cache.get(zpid);
    if (cachedEntry && (now - cachedEntry.timestamp) < CACHE_TTL_MS) {
      results.push(cachedEntry.extract);
      console.log(`Cache hit for ZPID: ${zpid}`);
      continue;
    }

    console.log(`Fetching data for ZPID: ${zpid}`);
    try {
      // Assuming ZenRows Real Estate Zillow Property Data API endpoint:
      // GET /targets/zillow/properties/{zpid}
      // This needs to be confirmed with ZenRows documentation for bulk operations.
      // If truly bulk, the request structure would change.
      const response = await axios.get(`${ZENROWS_ZILLOW_PROPERTY_BASE_URL}targets/zillow/properties/${zpid}`, {
        params: {
          apikey: ZENROWS_API_KEY,
          // ZenRows specific params like js_render, antibot, premium_proxy might be needed here
          // e.g., js_render: 'true', antibot: 'true'
        }
      });

      const data = response.data; // This is the parsed JSON from ZenRows

      // --- Data Mapping START ---
      // This mapping is crucial and depends heavily on the actual structure of the ZenRows response.
      // The following is a placeholder based on common Zillow data fields.
      const extract: ZillowExtract = {
        zpid,
        listPrice: data?.price?.value, // Example path
        zestimate: data?.zestimate?.value, // Example path
        daysOnSite: data?.daysOnZillow, // Example path
        priceHistory: data?.priceHistory?.map((event: any) => ({
          event: event.eventName,
          date: event.date,
          price: event.price,
        })) || [],
        latitude: data?.latitude,
        longitude: data?.longitude,
        zip: data?.address?.zipcode,
        rawResponse: data, // Store raw response for debugging
      };
      // --- Data Mapping END ---

      results.push(extract);
      cache.set(zpid, { extract, timestamp: Date.now() }); // Update cache

    } catch (error: any) {
      console.error(`Failed to fetch data for ZPID ${zpid}:`, error.response?.data || error.message);
      // Optionally, return partial data or a specific error structure
      results.push({ zpid, rawResponse: { error: error.response?.data || error.message } });
    }
  }
  return results;
}

// Example usage (for testing this module if run directly)
// async function testFetch() {
//   if (!process.env.ZENROWS_API_KEY) {
//     console.log("Skipping test: ZENROWS_API_KEY not set in .env file for packages/api");
//     return;
//   }
//   const testZpids = ['24603096']; // Example ZPID
//   try {
//     const extracts = await fetchZillowDataForZpids(testZpids);
//     console.log(JSON.stringify(extracts, null, 2));
//   } catch (e) {
//     console.error("Test fetch failed:", e);
//   }
// }

// if (require.main === module) {
//   // Ensure .env is loaded if testing directly from packages/api directory
//   const dotenv = require('dotenv');
//   const path = require('path');
//   dotenv.config({ path: path.resolve(process.cwd(), '.env') }); 
//   testFetch();
// } 