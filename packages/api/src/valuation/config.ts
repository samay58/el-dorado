// Valuation engine configuration 

export const VALUATION_WEIGHTS = {
  deltaZ: -1.0,      // Cheaper relative to Zestimate is better
  domPct: -0.6,      // Longer on market (higher % of median DOM) is better (less frenzy)
  recentCut: -0.4,   // Recent price cut is better
  hotFlag: 0.5,      // Penalize if it's a "hot home" (more competition)
  // Removed hcDelta and attomDelta weights
  // New weights for public data signals will be added here, e.g.:
  // listPriceToMedianZipRatio: -0.8,
  // ppsfToMedianZipRatio: -0.7,
  // domToMedianZipRatio: -0.5,
  // zhviAppreciation12Mo: 0.6,
  // marketHotnessScore: 0.4,
  // hedonicDelta: -1.2,
};

export const SF_MEDIAN_DOM = 55; // Placeholder, ideally fetched dynamically or updated periodically

export const MAX_PARALLEL_EXTERNAL_CALLS = 3; // Max concurrent calls to external AVMs like HouseCanary/ATTOM

export const ZILLOW_BULK_REQUEST_SIZE = 10; // Number of ZPIDs to include in a single ZenRows bulk request 