import { describe, it, expect } from 'vitest';
import { computeValue, AllSignals } from '../math/compute';
// import { VALUATION_WEIGHTS } from '../config'; // For property-based tests if needed
// import * as fc from 'fast-check'; // For property-based tests

// --- Mock/Example Fixture Data ---
// Ideally, load these from JSON files in __fixtures__
// For demonstration, defining inline. Replace with actual fixture loading.
const mockZillowExtractZpid12345 = {
  zpid: '12345',
  listPrice: 2000000,
  zestimate: 1900000,
  daysOnSite: 30,
  priceHistory: [
    { event: 'Listed for sale', date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), price: 2000000 },
  ],
  // latitude, longitude, zip would come from actual ZillowExtract
};

const mockZillowExtractZpid67890 = {
  zpid: '67890',
  listPrice: 1500000,
  zestimate: 1600000,
  daysOnSite: 70,
  priceHistory: [
    { event: 'Price Change', date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), price: 1500000 },
    { event: 'Listed for sale', date: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString(), price: 1550000 },
  ],
};

// --- Helper to create AllSignals from a ZillowExtract mock ---
// This would need to be more sophisticated if Redfin/HC/ATTOM signals were real
const createSignalsForTest = (zillowData: any, otherSignals?: Partial<AllSignals>): AllSignals => {
  // Simulate deriving signals from Zillow data (simplified version of zillowDerived.ts logic)
  const derived = {
    deltaZ: (zillowData.listPrice && zillowData.zestimate) ? (zillowData.listPrice - zillowData.zestimate) / zillowData.zestimate : undefined,
    domPct: zillowData.daysOnSite ? zillowData.daysOnSite / 55 : undefined, // Assuming SF_MEDIAN_DOM = 55
    recentCut: 0, // Simplified: needs proper PriceHistoryEvent[] and logic from zillowDerived.ts
  };
  if (zillowData.priceHistory && zillowData.priceHistory.length > 1 && /price change/i.test(zillowData.priceHistory[0].event) && zillowData.priceHistory[0].price < zillowData.priceHistory[1].price) {
    const eventDate = new Date(zillowData.priceHistory[0].date);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (eventDate >= thirtyDaysAgo) {
      derived.recentCut = 1;
    }
  }

  return {
    ...derived,
    ...otherSignals,
  };
};

describe('computeValue', () => {
  it('should calculate valueIndex and breakdown correctly for fixture 1 (ZPID 12345)', () => {
    const signals = createSignalsForTest(mockZillowExtractZpid12345, { hotFlag: 0 });
    const result = computeValue(signals);

    // Snapshot testing is excellent here
    expect(result.valueIndex).toMatchSnapshot('valueIndex_zpid12345');
    expect(result.rawScore).toMatchSnapshot('rawScore_zpid12345');
    expect(result.breakdown).toMatchSnapshot('breakdown_zpid12345');
    
    // Example explicit checks (less maintainable than snapshots for complex objects)
    // expect(result.valueIndex).toBeCloseTo(-0.78, 2); // Value depends heavily on placeholder STATS
  });

  it('should calculate valueIndex and breakdown correctly for fixture 2 (ZPID 67890)', () => {
    const signals = createSignalsForTest(mockZillowExtractZpid67890, { hotFlag: 1, hcDelta: -0.05 });
    const result = computeValue(signals);

    expect(result.valueIndex).toMatchSnapshot('valueIndex_zpid67890');
    expect(result.rawScore).toMatchSnapshot('rawScore_zpid67890');
    expect(result.breakdown).toMatchSnapshot('breakdown_zpid67890');
  });

  it('should handle missing optional signals gracefully', () => {
    const signals: AllSignals = {
      // Only provide mandatory ones, or even fewer if computeValue can handle it
      deltaZ: 0.1,
      domPct: 1.2,
      // recentCut, hotFlag, hcDelta, attomDelta are missing
    };
    const result = computeValue(signals);
    // Check that it doesn't crash and produces a number
    expect(typeof result.valueIndex).toBe('number');
    expect(result.breakdown.recentCut).toBeUndefined(); // Or expect it to be 0 if that's the default
    expect(result.breakdown.hotFlag).toBeDefined(); // hotFlag defaults to 0 * weight
    // Add more assertions based on expected behavior with missing signals
  });

  // --- Property-Based Tests (using fast-check) ---
  // describe('property-based tests', () => {
  //   it('valueIndex should decrease as deltaZ increases (ceteris paribus)', () => {
  //     fc.assert(
  //       fc.property(fc.double({ min: -0.5, max: 0.5, noNaN: true }), deltaZ => {
  //         const signals1: AllSignals = { deltaZ: deltaZ, domPct: 1.0, recentCut: 0, hotFlag: 0 };
  //         const signals2: AllSignals = { deltaZ: deltaZ + 0.1, domPct: 1.0, recentCut: 0, hotFlag: 0 };
  //         const result1 = computeValue(signals1);
  //         const result2 = computeValue(signals2);
  //         // VALUATION_WEIGHTS.deltaZ is negative (-1.0)
  //         expect(result2.valueIndex).toBeLessThanOrEqual(result1.valueIndex);
  //       })
  //     );
  //   });

  //   // Add more property-based tests for other signals and their expected impact on valueIndex
  //   // e.g., valueIndex should decrease as domPct increases (weight is -0.6)
  //   // e.g., valueIndex should decrease if recentCut is 1 (weight is -0.4)
  //   // e.g., valueIndex should increase if hotFlag is 1 (weight is +0.5)
  // });
}); 