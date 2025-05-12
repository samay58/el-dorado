import { PrismaClient, Criterion } from '@my-real-estate-app/db';
import * as fastFuzzy from 'fast-fuzzy'; // Import fast-fuzzy
import { point, distance } from '@turf/turf'; // Corrected import for Turf.js modules
import {
  CONFIDENCE_LEVELS,
  FUZZY_MATCH_MIN_SCORE,
  PREFERRED_AREAS,
  GEO_PROXIMITY_FULL_BONUS_KM,
  GEO_PROXIMITY_HALF_BONUS_KM,
  ZIP_MATCH_BONUS
} from './config/scoringConfig'; // Corrected import path

// const prisma = new PrismaClient(); // Remove global instance here

/**
 * Escapes a string to be used in a regular expression.
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

/**
 * Compiles a single pattern string into a RegExp object.
 * - If pattern is like '/regex/flags', it's parsed as a full regex.
 * - If pattern contains '|', it's treated as an OR condition for simple strings.
 * - Otherwise, it's treated as a simple case-insensitive keyword/phrase search.
 * Returns null if compilation fails.
 */
function compileSinglePatternToRegex(pattern: string, criterionKey?: string, criterionId?: string): RegExp | null {
  try {
    // Check if the pattern is a full regex (e.g., /pattern/flags)
    const fullRegexMatch = pattern.match(/^\/(.+)\/([gimyusdv]*)$/);
    if (fullRegexMatch && typeof fullRegexMatch[1] === 'string') {
      return new RegExp(fullRegexMatch[1], fullRegexMatch[2] || '');
    } else if (pattern.includes('|')) {
      // Treat as OR-separated simple strings, case-insensitive, global match
      const parts = pattern.split('|').map((part: string) => escapeRegExp(part.trim()));
      return new RegExp(`(${parts.join('|')})`, 'gi');
    } else {
      // Treat as a simple keyword/phrase, case-insensitive, global match
      return new RegExp(escapeRegExp(pattern), 'gi');
    }
  } catch (e: any) {
    console.error(`Failed to compile regex for pattern '${pattern}'${criterionKey ? ` (criterion: ${criterionKey}, ID: ${criterionId})` : ''}. Error: ${e.message}`);
    // Optionally log to EtlError table here
    return null;
  }
}

export interface PreparedCriterion extends Omit<Criterion, 'pattern' | 'synonyms' | 'id' | 'updatedAt'> {
  // Omit original pattern and synonyms as they are now processed into regexPatterns
  // id and updatedAt are not needed for scoring logic itself after preparation.
  key: string;
  must: boolean;
  weight: number;
  regexPatterns: { regex: RegExp, originalPattern: string, type: 'primary' | 'synonym' }[];
  // Store the primary pattern string separately for potential fuzzy matching if no regex hits
  primaryPatternString: string; 
}

/**
 * Loads all criteria from the database and prepares them by compiling their pattern strings
 * (including synonyms) into RegExp objects.
 * @param prismaInstance An instance of PrismaClient
 */
export async function loadAndPrepareCriteria(prismaInstance: PrismaClient): Promise<PreparedCriterion[]> {
  const allCriteria = await prismaInstance.criterion.findMany({});
  const preparedCriteria: PreparedCriterion[] = [];

  for (const criterion of allCriteria) {
    const regexPatterns: PreparedCriterion['regexPatterns'] = [];

    // Compile the primary pattern only if it's a non-empty string
    if (criterion.pattern && criterion.pattern.trim() !== '') {
      const primaryRegex = compileSinglePatternToRegex(criterion.pattern, criterion.key, criterion.id);
      if (primaryRegex) {
        regexPatterns.push({ regex: primaryRegex, originalPattern: criterion.pattern, type: 'primary' });
      }
    }

    // Compile synonyms
    if (criterion.synonyms && criterion.synonyms.length > 0) {
      for (const synonymPattern of criterion.synonyms) {
        if (synonymPattern && synonymPattern.trim() !== '') { // Ensure synonym is not empty
          const synonymRegex = compileSinglePatternToRegex(synonymPattern, criterion.key, criterion.id);
          if (synonymRegex) {
            regexPatterns.push({ regex: synonymRegex, originalPattern: synonymPattern, type: 'synonym' });
          }
        }
      }
    }

    // Only add the criterion if it has at least one valid compiled regex pattern
    if (regexPatterns.length > 0) {
      preparedCriteria.push({
        key: criterion.key,
        must: criterion.must,
        weight: criterion.weight,
        regexPatterns,
        // primaryPatternString should still be the original, even if it didn't compile or was empty, 
        // for potential non-regex use or simpler fuzzy matching target if needed.
        primaryPatternString: criterion.pattern, 
      });
    } else {
      console.warn(`No valid regex patterns could be compiled for criterion '${criterion.key}' (ID: ${criterion.id}). It will be skipped if it also has no primaryPatternString for fuzzy matching, or if fuzzy matching logic strictly needs a non-empty primaryPatternString.`);
      // If primaryPatternString is also empty/null and no regexes, it will be naturally skipped by downstream logic needing it for fuzzy.
      // If we want to be stricter and ONLY include if regexPatterns is non-empty:
      // console.warn(...); // then simply don't push to preparedCriteria
      // The current logic in scoreListing will attempt fuzzy if regexPatterns is empty BUT primaryPatternString exists.
      // For consistency with tests expecting items to be skipped if regexes fail, we'll stick to only pushing if regexPatterns.length > 0 for now.
      // This means if a criterion only has an invalid primary pattern and no valid synonyms, it's out.
    }
  }
  // The console log was here, it should reflect the length of the actually prepared criteria.
  console.log(`Loaded and prepared ${preparedCriteria.length} criteria with a total of ${preparedCriteria.reduce((sum, pc) => sum + pc.regexPatterns.length, 0)} regex patterns.`);
  return preparedCriteria;
}

// Renaming ListingScore to ListingScoreV1 for clarity if needed elsewhere
export interface ListingScoreV1 {
  alignmentScore: number;
  missingMusts: string[];
  matchedCriteriaKeys: string[];
}

// New ListingScoreV2 for enhanced scoring
export interface ListingScoreV2 {
  alignmentScore: number;
  missingMusts: string[];
  matchedCriteriaKeys: string[]; // Keys of criteria that had at least one pattern match
  detailedHits: { 
    criterionKey: string; 
    matchedPattern: string; 
    matchType: 'primary' | 'synonym' | 'fuzzy'; // Added 'fuzzy'
    confidence: number 
  }[];
  locationBonus: number;
}

/**
 * Scores a listing based on its JSON data and prepared criteria.
 * (V2 - initial refactor for multiple regex patterns, confidence and geo to be added next)
 * @param listingJsonData The JSON object from ListingRaw.json (Zillow Property Data API response)
 * @param preparedCriteria Array of PreparedCriterion objects
 * @returns ListingScoreV2 object
 */
export function scoreListing(
  listingJsonData: any, // Should ideally be a more specific type for Zillow Property Data
  preparedCriteria: PreparedCriterion[]
): ListingScoreV2 { // Changed return type
  let totalWeightedHitScore = 0; // Changed from totalWeightOfHits to reflect confidence weighting
  let totalPossibleWeight = 0;
  const missingMusts: string[] = [];
  const matchedCriteriaKeys: string[] = [];
  const detailedHits: ListingScoreV2['detailedHits'] = [];
  let currentLocationBonus = 0; // Initialize location bonus

  // Combine description and features into the text to search
  const description = (listingJsonData?.property_description || '').toLowerCase();
  const features = (Array.isArray(listingJsonData?.features) ? listingJsonData.features.join(' ') : '').toLowerCase();
  // Ensure a space between description and features if both exist
  const textToSearch = `${description} ${features}`.trim(); 
  
  // TODO: Consider other text fields or feature lists from Zillow (e.g., listingJsonData.features) - Removed TODO as it's addressed now

  if (!textToSearch) { // Check if the combined text is empty
    console.warn('No searchable text (description or features) found for listing', listingJsonData?.property_url || listingJsonData?.zpid);
  }

  for (const criterion of preparedCriteria) {
    totalPossibleWeight += criterion.weight;
    let criterionIsHit = false;
    let hitConfidence = 0;
    let hitType: 'primary' | 'synonym' | 'fuzzy' | null = null;
    let hitPattern = '';

    if (textToSearch) {
      // 1. Check Regex Patterns (Primary and Synonyms)
      for (const patternInfo of criterion.regexPatterns) {
        patternInfo.regex.lastIndex = 0; // Reset lastIndex for global regexes
        if (patternInfo.regex.test(textToSearch)) {
          criterionIsHit = true;
          hitType = patternInfo.type;
          hitPattern = patternInfo.originalPattern;
          hitConfidence = (patternInfo.type === 'primary') ? CONFIDENCE_LEVELS.PRIMARY : CONFIDENCE_LEVELS.SYNONYM;
          break; // First regex hit determines the type and base confidence for regex
        }
      }

      // 2. If no Regex hit, try Fuzzy Match on primary pattern string (or criterion key)
      if (!criterionIsHit && criterion.primaryPatternString && textToSearch) { // Added textToSearch check here too
        const fuzzyResults = fastFuzzy.search(textToSearch, [criterion.primaryPatternString], { returnMatchData: true });
        // Check if fuzzyResults has any items AND the first item meets the score threshold
        if (fuzzyResults.length > 0 && fuzzyResults[0] && typeof fuzzyResults[0].score === 'number' && fuzzyResults[0].score >= FUZZY_MATCH_MIN_SCORE) {
          const bestFuzzyMatch = fuzzyResults[0]; // Now safe to access
          criterionIsHit = true;
          hitType = 'fuzzy';
          hitPattern = bestFuzzyMatch.item; // This is criterion.primaryPatternString
          hitConfidence = CONFIDENCE_LEVELS.FUZZY;
          // console.log(`Fuzzy hit for ${criterion.key}: '${bestFuzzyMatch.match}' in text with score ${bestFuzzyMatch.score}`);
        }
      }
    }
    
    // Calculate Location Bonus
    const listingLat = listingJsonData?.latitude;
    const listingLon = listingJsonData?.longitude;
    const listingZip = listingJsonData?.address?.zipcode as string | undefined;

    if (typeof listingLat === 'number' && typeof listingLon === 'number') {
      const listingPoint = point([listingLon, listingLat]);
      for (const area of PREFERRED_AREAS) {
        const areaPoint = point(area.centroid);
        const distInKm = distance(listingPoint, areaPoint, { units: 'kilometers' });

        if (distInKm <= GEO_PROXIMITY_FULL_BONUS_KM) {
          currentLocationBonus = Math.max(currentLocationBonus, area.weight); // Take the highest bonus if multiple full matches
          // To sum bonuses from multiple areas, use: currentLocationBonus += area.weight;
          // For now, let's assume only one area provides the primary bonus, or we take max.
          // If we want to log which area gave the bonus, we can add to detailedHits or a new field.
          break; // Found a full bonus, stop checking (or remove to allow multiple full bonuses to stack if logic changes)
        } else if (distInKm <= GEO_PROXIMITY_HALF_BONUS_KM) {
          currentLocationBonus = Math.max(currentLocationBonus, area.weight / 2);
          // If not breaking on full match, a half match might still be the highest if no full matches
        }
      }
    } else if (listingZip) {
      // Fallback to ZIP code match if coordinates are not available
      for (const area of PREFERRED_AREAS) {
        if (area.zip === listingZip) {
          currentLocationBonus = Math.max(currentLocationBonus, ZIP_MATCH_BONUS);
          break; // First ZIP match gives a small fixed bonus
        }
      }
    }
    // End Calculate Location Bonus

    if (criterionIsHit && hitType) { // Ensure hitType is not null
      if (criterion.key === 'Fuzzy Test' && hitType === 'fuzzy') {
        console.debug({ // Changed to console.debug
            msg: 'Fuzzy Test HIT Debug',
            key: criterion.key,
            weight: criterion.weight,
            confidence: hitConfidence,
            calculatedHitScore: criterion.weight * hitConfidence,
            currentTotalWeightedHitScore: totalWeightedHitScore 
        }, 'Fuzzy Test HIT Debug');
      }
      // ADDED: More general logging for any hit
      console.debug({
        msg: 'Criterion HIT',
        key: criterion.key,
        matchType: hitType,
        matchedPattern: hitPattern,
        weight: criterion.weight,
        confidence: hitConfidence,
        contribution: criterion.weight * hitConfidence,
        textSearched: textToSearch // Log the text to see what it's matching against
      });
      // END ADDED
      totalWeightedHitScore += criterion.weight * hitConfidence;
      if (!matchedCriteriaKeys.includes(criterion.key)) {
        matchedCriteriaKeys.push(criterion.key);
      }
      detailedHits.push({
        criterionKey: criterion.key,
        matchedPattern: hitPattern,
        matchType: hitType,
        confidence: hitConfidence,
      });
    } else {
      if (criterion.must) {
        missingMusts.push(criterion.key);
      }
    }
  }

  // Alignment score is now based on the weighted hit score vs total possible raw weight
  const alignmentScore = totalPossibleWeight > 0 ? (totalWeightedHitScore / totalPossibleWeight) * 100 : 0;

  return {
    alignmentScore: parseFloat(alignmentScore.toFixed(2)),
    missingMusts,
    matchedCriteriaKeys,
    detailedHits,
    locationBonus: parseFloat(currentLocationBonus.toFixed(2)), // Assign calculated bonus
  };
}

// Example usage (for testing this module directly if needed):
// async function testPreparationAndScoring() {
//   console.log("Testing criteria preparation...");
//   const criteria = await loadAndPrepareCriteria();
//   criteria.forEach(c => {
//     console.log(`Criterion Key: ${c.key}, Must: ${c.must}, Weight: ${c.weight}`);
//     c.regexPatterns.forEach(p => {
//       console.log(`  Pattern (${p.type}): ${p.originalPattern} -> ${p.regex}`);
//     });
//   });

//   // Mock listing data for testing scoreListing
//   const mockListingJson = {
//     property_description: "A beautiful home with abundant sunlight and modern appliances. Has in-unit laundry. Located in Dolores Heights.",
//     address: {
//       city: "San Francisco",
//       neighborhood: "Dolores Heights"
//     }
//     // features: ["High Ceilings", "Pet-Friendly"]
//   };

//   if (criteria.length > 0) {
//     console.log("\nTesting scoring with mock data...");
//     const score = scoreListing(mockListingJson, criteria);
//     console.log("Score Result:", JSON.stringify(score, null, 2));
//   }
// }

// testPreparationAndScoring().catch(console.error);

// Old interfaces, to be removed or refactored if they were used externally
// export interface CompiledCriterion extends Criterion {
//   regex: RegExp;
// }