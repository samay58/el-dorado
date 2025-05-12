import { ZillowExtract, PriceHistoryEvent } from '../extractors/zillow';
import { SF_MEDIAN_DOM } from '../config';

export interface DerivedSignals {
  deltaZ?: number;
  domPct?: number;
  recentCut?: number; // 1 if recent cut, 0 if not, undefined if not determinable
}

/**
 * Derives signals directly from ZillowExtract data.
 * @param extract - The ZillowExtract object for a listing.
 * @returns DerivedSignals object.
 */
export function deriveZillowSignals(extract: ZillowExtract): DerivedSignals {
  const signals: DerivedSignals = {};

  // Calculate deltaZ: (listPrice – zestimate) / zestimate
  if (extract.listPrice && extract.zestimate && extract.zestimate > 0) {
    signals.deltaZ = (extract.listPrice - extract.zestimate) / extract.zestimate;
  } else if (extract.listPrice && !extract.zestimate) {
    // If zestimate is missing, we can't calculate deltaZ in its primary form.
    // For now, leave undefined. Orchestrator might use a different AVM's delta.
  }

  // Calculate domPct: daysOnSite / SF_median_DOM
  if (extract.daysOnSite !== undefined && SF_MEDIAN_DOM > 0) {
    signals.domPct = extract.daysOnSite / SF_MEDIAN_DOM;
  }

  // Calculate recentCut: 1 if last price-history event is a cut ≤ 30 days ago, 0 otherwise
  if (extract.priceHistory && extract.priceHistory.length > 0) {
    const sortedHistory = [...extract.priceHistory].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const lastEvent = sortedHistory[0];

    if (lastEvent) { // Ensure lastEvent is defined
      const priceCutEventPattern = /price change|price reduced/i;

      if (priceCutEventPattern.test(lastEvent.event)) {
        const eventDate = new Date(lastEvent.date);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        if (eventDate >= thirtyDaysAgo) {
          if (sortedHistory.length > 1) {
            const previousEvent = sortedHistory[1];
            if (previousEvent && lastEvent.price < previousEvent.price) { // Ensure previousEvent is defined
              signals.recentCut = 1;
            } else {
              signals.recentCut = 0; // Price change, but not a reduction or previousEvent undefined
            }
          } else {
            signals.recentCut = 0; // Initial listing price, not a cut
          }
        } else {
          signals.recentCut = 0; // Price change event, but older than 30 days
        }
      } else {
        signals.recentCut = 0; // Last event was not a price cut type
      }
    } else {
      signals.recentCut = undefined; // Should not happen if length > 0, but defensive
    }
  } else {
    signals.recentCut = undefined; // No price history
  }

  return signals;
} 