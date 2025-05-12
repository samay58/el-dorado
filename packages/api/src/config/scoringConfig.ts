export const CONFIDENCE_LEVELS = {
  PRIMARY: 1.0,
  SYNONYM: 0.7,
  FUZZY: 0.6, // Applied if fuzzy match score is >= FUZZY_MATCH_MIN_SCORE
};

export const FUZZY_MATCH_MIN_SCORE = 0.7;

export const PREFERRED_AREAS = [
  { name: "Dolores Heights", centroid: [-122.4261, 37.7598], weight: 30, zip: "94110" },
  { name: "Noe Valley", centroid: [-122.4330, 37.7518], weight: 25, zip: "94114" },
  { name: "Potrero Hill", centroid: [-122.3968, 37.7586], weight: 22, zip: "94107" },
  { name: "Pacific Heights", centroid: [-122.43, 37.7925], weight: 22, zip: "94115" },
  { name: "Marina District", centroid: [-122.4399, 37.8025], weight: 18, zip: "94123" },
  { name: "North Beach", centroid: [-122.4084, 37.8050], weight: 7, zip: "94133" },
  // Add more preferred areas as needed
];

export const GEO_PROXIMITY_FULL_BONUS_KM = 0.8;
export const GEO_PROXIMITY_HALF_BONUS_KM = 1.5;
export const ZIP_MATCH_BONUS = 5; // Smaller bonus for a direct ZIP code match if no coords 