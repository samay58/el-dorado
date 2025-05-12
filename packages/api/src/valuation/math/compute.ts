import { VALUATION_WEIGHTS } from '../config';
import { zScore } from './stat';
import { DerivedSignals } from '../signals/zillowDerived';
import { RedfinSignals } from '../signals/redfin'; // Assuming stubs might provide some optional fields

// Combine all possible signal sources into one type for computeValue
export interface AllSignals extends DerivedSignals, RedfinSignals {
  // Add any other signals that might come from different sources
  hotFlag?: number; // Example: 0 or 1, sourced from Redfin or elsewhere eventually
  // New public data signals will be added here, e.g.:
  // listPriceToMedianZipRatio?: number;
  // ppsfToMedianZipRatio?: number;
  // domToMedianZipRatio?: number;
  // zhviAppreciation12Mo?: number;
  // marketHotnessScore?: number;
  // hedonicDelta?: number; // From new hedonic model
}

export interface ValueComputationResult {
  valueIndex: number;
  rawScore: number; // Sum of weighted contributions before any final scaling if needed
  breakdown: Record<string, number>; // Weighted contribution of each signal
  // Optionally include z-scores themselves if useful for debugging
  // zScores?: Record<string, number>; 
}

// --- PLACEHOLDER STATISTICS ---
// These will be re-evaluated based on new public data signals.
const STATS = {
  deltaZ:     { mean: 0.05, stdDev: 0.15 },  
  domPct:     { mean: 1.0,  stdDev: 0.5  },
  // New stats for new signals will be added here
  // listPriceToMedianZipRatio: { mean: 1.0, stdDev: 0.2 },
  // ppsfToMedianZipRatio: { mean: 1.0, stdDev: 0.2 },
  // domToMedianZipRatio: { mean: 1.0, stdDev: 0.3 },
};
// --- END PLACEHOLDER STATISTICS ---

/**
 * Computes the valueIndex and its components from a set of signals.
 * This function will be significantly refactored based on new public data signals.
 * Old formula (for reference, will be replaced):
 *   -1.0 * z(deltaZ) 
 *   -0.6 * z(domPct) 
 *   -0.4 * recentCut 
 *   +0.5 * hotFlag 
 *   -0.3 * z(hcDelta ?? deltaZ) 
 *   -0.2 * z(attomDelta ?? deltaZ);
 */
export function computeValue(signals: AllSignals): ValueComputationResult {
  const breakdown: Record<string, number> = {};
  let rawScore = 0;

  // deltaZ (from Zillow extract)
  if (signals.deltaZ !== undefined) {
    const zDeltaZ = zScore(signals.deltaZ, STATS.deltaZ.mean, STATS.deltaZ.stdDev);
    const weightedZDeltaZ = VALUATION_WEIGHTS.deltaZ * zDeltaZ;
    breakdown.deltaZ = weightedZDeltaZ;
    rawScore += weightedZDeltaZ;
  }

  // domPct (from Zillow extract, relative to SF_MEDIAN_DOM)
  if (signals.domPct !== undefined) {
    const zDomPct = zScore(signals.domPct, STATS.domPct.mean, STATS.domPct.stdDev);
    const weightedZDomPct = VALUATION_WEIGHTS.domPct * zDomPct;
    breakdown.domPct = weightedZDomPct;
    rawScore += weightedZDomPct;
  }

  // recentCut (from Zillow extract, not z-scored, used directly)
  if (signals.recentCut !== undefined) {
    const weightedRecentCut = VALUATION_WEIGHTS.recentCut * signals.recentCut;
    breakdown.recentCut = weightedRecentCut;
    rawScore += weightedRecentCut;
  }

  // hotFlag (placeholder, will be from Realtor.com or Redfin)
  const hotFlagValue = signals.hotFlag !== undefined ? signals.hotFlag : 0; 
  const weightedHotFlag = VALUATION_WEIGHTS.hotFlag * hotFlagValue;
  breakdown.hotFlag = weightedHotFlag;
  rawScore += weightedHotFlag;

  // TODO: Implement new signal processing based on public data
  // e.g., listPriceToMedianZipRatio, zhviAppreciation12Mo, marketHotnessScore, hedonicDelta
  // Each will have its own weight, potential z-scoring, and addition to rawScore & breakdown.

  // Removed hcDelta and attomDelta logic
  
  return {
    valueIndex: parseFloat(rawScore.toFixed(2)), 
    rawScore: parseFloat(rawScore.toFixed(4)), 
    breakdown,
  };
} 