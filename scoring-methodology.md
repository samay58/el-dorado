# Scoring Engine Methodology (v2)

This document outlines the methodology used by the automated scoring engine to evaluate real estate listings based on user-defined criteria.

## Core Components

1.  **Criteria (`Criterion` Table):**
    *   Each criterion defines a specific desirable (or undesirable) feature or aspect of a property.
    *   Fields:
        *   `key`: A human-readable name (e.g., "Natural Light", "Quiet Street").
        *   `weight`: A numerical value (1-100) indicating the importance of the criterion.
        *   `must`: A boolean (`true`/`false`) indicating if the criterion is a mandatory requirement.
        *   `pattern`: The primary string pattern used for matching. This can be a simple phrase, a list of OR-separated phrases (using `|`), or a full regular expression (enclosed in `/.../flags`).
        *   `synonyms`: An array of alternative string patterns that also satisfy the criterion.

2.  **Listing Data (`ListingRaw` Table):**
    *   Raw JSON data fetched from Zillow's Property Data API for each listing.
    *   The scoring engine primarily analyzes the `property_description` field within this JSON, but can be extended to other fields (like feature lists).

3.  **Compiled Criteria (`PreparedCriterion`):**
    *   Before scoring, criteria are loaded from the database.
    *   The primary `pattern` and each `synonym` for every criterion are compiled into case-insensitive, global regular expression objects (`RegExp`).
    *   If a `pattern` string in the database is enclosed in slashes (e.g., `/my-regex/i`), it's treated as a direct regular expression; otherwise, it's treated as a literal phrase (or `|` separated phrases) for which a regex is generated.

4.  **Score Output (`Score` Table & `ListingScoreV2` Interface):**
    *   `alignmentScore`: A normalized score (0-100) indicating overall alignment with weighted criteria.
    *   `missingMusts`: An array of `key`s for any `must=true` criteria that were not met.
    *   `matchedCriteriaKeys`: An array of `key`s for all criteria that were met (regardless of `must` status).
    *   `detailedHits`: An array providing specifics for each match, including:
        *   `criterionKey`: The key of the matched criterion.
        *   `matchedPattern`: The specific original pattern string (primary or synonym) that triggered the match.
        *   `matchType`: Indicates how the match occurred ('primary', 'synonym', or 'fuzzy').
        *   `confidence`: The confidence level assigned to that specific match type.
    *   `locationBonus`: A numerical bonus score based on proximity to preferred neighborhoods.

## Scoring Logic

For each listing and each prepared criterion:

1.  **Pattern Matching (Regex & Synonyms):**
    *   The engine iterates through all compiled `RegExp` objects associated with a criterion (from its primary `pattern` and all its `synonyms`).
    *   If any of these regexes match the listing's `property_description` (case-insensitive, global):
        *   The criterion is considered a "hit."
        *   A **confidence level** is assigned based on the match type:
            *   Primary Pattern Match: `CONFIDENCE_LEVELS.PRIMARY` (currently 1.0)
            *   Synonym Match: `CONFIDENCE_LEVELS.SYNONYM` (currently 0.8)
        *   The first successful regex match for a criterion determines its hit status and confidence for this step.

2.  **Fuzzy Matching (if no Regex/Synonym hit):**
    *   If none of the criterion's regex patterns (primary or synonym) match:
        *   A fuzzy search (using the `fast-fuzzy` library) is performed using the criterion's original primary `pattern` string against the listing's `property_description`.
        *   If a fuzzy match is found with a similarity score >= `FUZZY_MATCH_MIN_SCORE` (currently 0.8):
            *   The criterion is considered a "hit."
            *   Confidence Level: `CONFIDENCE_LEVELS.FUZZY` (currently 0.6)

3.  **Hit Contribution:**
    *   If a criterion is a "hit" (via regex, synonym, or fuzzy match), its contribution to the score is: `criterion.weight * confidence_of_the_match`.
    *   This weighted hit score is added to a running `totalWeightedHitScore` for the listing.

4.  **Tracking:**
    *   `matchedCriteriaKeys` records the key of every criterion that had any type of hit.
    *   `detailedHits` records the specifics of each hit (key, pattern, type, confidence).
    *   If a criterion is `must=true` and was *not* a hit, its key is added to `missingMusts`.

5.  **Alignment Score Calculation:**
    *   `totalPossibleWeight` is the sum of all `weight`s of all criteria being evaluated.
    *   `alignmentScore = (totalWeightedHitScore / totalPossibleWeight) * 100`.
    *   This score is normalized to a 0-100 scale and rounded to two decimal places.

6.  **Location Bonus (`locationBonus`):**
    *   The listing's latitude and longitude (from `ListingRaw.json`) are compared against a predefined list of `PREFERRED_AREAS`.
    *   Each preferred area has a centroid coordinate and a `weight` (bonus points).
    *   Distances are calculated using `@turf/distance`.
    *   **Full Bonus:** If distance <= `GEO_PROXIMITY_FULL_BONUS_KM` (currently 0.75km), the area's full `weight` is awarded.
    *   **Half Bonus:** If distance > full bonus radius but <= `GEO_PROXIMITY_HALF_BONUS_KM` (currently 1.5km), half the area's `weight` is awarded.
    *   The highest applicable bonus from any preferred area is taken (logic currently takes the max, doesn't sum multiple area bonuses).
    *   **ZIP Code Fallback:** If coordinates are unavailable, a smaller fixed `ZIP_MATCH_BONUS` (currently 5) is awarded if the listing's ZIP code matches any in the `PREFERRED_AREAS` list.
    *   The final `locationBonus` is added to the `Score` record (but not directly to the `alignmentScore` percentage; it's a separate metric).

## Configuration

Key parameters for scoring are centralized in `packages/api/src/config/scoringConfig.ts`:
*   `CONFIDENCE_LEVELS` (for PRIMARY, SYNONYM, FUZZY matches)
*   `FUZZY_MATCH_MIN_SCORE`
*   `PREFERRED_AREAS` (list of neighborhoods with centroids, weights, zips)
*   `GEO_PROXIMITY_FULL_BONUS_KM`
*   `GEO_PROXIMITY_HALF_BONUS_KM`
*   `ZIP_MATCH_BONUS`

This allows for easier tuning of the scoring behavior. 