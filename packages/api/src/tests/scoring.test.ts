import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client'; // Will be mocked
import { 
    loadAndPrepareCriteria, 
    scoreListing, 
    PreparedCriterion, 
    ListingScoreV2 
} from '../scoring'; // Corrected path: from ../src/scoring to ../scoring
import { 
    CONFIDENCE_LEVELS, 
    FUZZY_MATCH_MIN_SCORE, 
    PREFERRED_AREAS, 
    GEO_PROXIMITY_FULL_BONUS_KM, 
    GEO_PROXIMITY_HALF_BONUS_KM, 
    ZIP_MATCH_BONUS 
} from '../config/scoringConfig'; // Corrected path: from ../src/config to ../config

// Mock PrismaClient
vi.mock('@prisma/client', () => {
    const mockPrismaClient = {
        criterion: {
            findMany: vi.fn(),
        },
        // Add other models and methods if your scoring module starts using them directly
    };
    return { PrismaClient: vi.fn(() => mockPrismaClient) };
});

// Mock fast-fuzzy
vi.mock('fast-fuzzy', () => ({
    search: vi.fn(),
}));

// Mock @turf/turf (assuming point and distance are the main ones used from here)
vi.mock('@turf/turf', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual, // Spread actual to keep other turf exports if any are used indirectly
        point: vi.fn((coords) => ({ type: 'Point', coordinates: coords })),
        distance: vi.fn(),
    };
});

describe('Scoring Engine - Unit Tests', () => {
    let mockPrisma: PrismaClient;
    let mockFastFuzzySearch: any; // Renamed for clarity
    let mockTurfDistance: any;

    beforeEach(async () => {
        mockPrisma = new PrismaClient() as unknown as PrismaClient;
        if (mockPrisma.criterion && mockPrisma.criterion.findMany) {
            vi.mocked(mockPrisma.criterion.findMany).mockReset();
        }
        
        // Dynamically import mocked modules to get the mock functions
        const fastFuzzy = await import('fast-fuzzy');
        mockFastFuzzySearch = vi.mocked(fastFuzzy.search);
        mockFastFuzzySearch.mockReset();

        const turf = await import('@turf/turf');
        mockTurfDistance = vi.mocked(turf.distance);
        mockTurfDistance.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('loadAndPrepareCriteria', () => {
        it('should load criteria and compile patterns correctly', async () => {
            const mockCriteriaFromDb = [
                { id: '1', key: 'Natural Light', weight: 100, must: true, pattern: 'natural light', synonyms: ['sun-drenched'], updatedAt: new Date() },
                { id: '2', key: 'Open Kitchen', weight: 80, must: false, pattern: '/open kitchen/i', synonyms: [], updatedAt: new Date() },
                { id: '3', key: 'Noise', weight: 50, must: false, pattern: 'quiet|peaceful', synonyms: [], updatedAt: new Date() },
                { id: '4', key: 'Invalid Regex', weight: 10, must: false, pattern: '/[a-z/i', synonyms: [], updatedAt: new Date() }, // Malformed regex
            ];
            vi.mocked(mockPrisma.criterion.findMany).mockResolvedValue(mockCriteriaFromDb);

            const prepared = await loadAndPrepareCriteria(mockPrisma);

            expect(mockPrisma.criterion.findMany).toHaveBeenCalledTimes(1);
            expect(prepared.length).toBe(3); // Invalid Regex should be skipped
            
            const naturalLight = prepared.find((c: PreparedCriterion) => c.key === 'Natural Light');
            expect(naturalLight).toBeDefined();
            if (naturalLight) {
                expect(naturalLight.regexPatterns.length).toBe(2);
                expect(naturalLight.regexPatterns[0]?.type).toBe('primary');
                expect(naturalLight.regexPatterns[0]?.regex.toString()).toBe('/natural light/gi');
                expect(naturalLight.regexPatterns[1]?.type).toBe('synonym');
                expect(naturalLight.regexPatterns[1]?.regex.toString()).toBe('/sun-drenched/gi');
                expect(naturalLight.primaryPatternString).toBe('natural light');
            }

            const openKitchen = prepared.find((c: PreparedCriterion) => c.key === 'Open Kitchen');
            expect(openKitchen).toBeDefined();
            if (openKitchen) {
                expect(openKitchen.regexPatterns.length).toBe(1);
                expect(openKitchen.regexPatterns[0]?.regex.toString()).toBe('/open kitchen/i');
                expect(openKitchen.primaryPatternString).toBe('/open kitchen/i');
            }
            
            const noise = prepared.find((c: PreparedCriterion) => c.key === 'Noise');
            expect(noise).toBeDefined();
            if (noise) {
                expect(noise.regexPatterns.length).toBe(1);
                expect(noise.regexPatterns[0]?.regex.toString()).toBe('/(quiet|peaceful)/gi');
            }
        });

        it('should handle criteria with only synonyms and no primary pattern if primary pattern is empty but regexPatterns get populated', async () => {
            const mockCriteriaFromDb = [
                { id: '1', key: 'Synonym Only', weight: 10, must: false, pattern: '', synonyms: ['test synonym'], updatedAt: new Date() },
            ];
            vi.mocked(mockPrisma.criterion.findMany).mockResolvedValue(mockCriteriaFromDb);
            const prepared = await loadAndPrepareCriteria(mockPrisma);
            expect(prepared.length).toBe(1);
            if (prepared[0]) {
                expect(prepared[0].regexPatterns.length).toBe(1); // Only synonym regex
                expect(prepared[0].regexPatterns[0]?.type).toBe('synonym');
                expect(prepared[0].primaryPatternString).toBe('');
            }
        });

        it('should skip criterion if no patterns (primary or synonym) compile', async () => {
            const mockCriteriaFromDb = [
                { id: '1', key: 'Bad Pattern', weight: 10, must: false, pattern: '/[invalid/', synonyms: ['/[alsoinvalid/'], updatedAt: new Date() },
            ];
            vi.mocked(mockPrisma.criterion.findMany).mockResolvedValue(mockCriteriaFromDb);
            const prepared = await loadAndPrepareCriteria(mockPrisma);
            expect(prepared.length).toBe(0);
        });
    });

    describe('scoreListing', () => {
        let preparedCriteria: PreparedCriterion[];

        beforeEach(async () => {
            // Default mock for fastFuzzy.search to prevent undefined errors in non-fuzzy tests
            mockFastFuzzySearch.mockReturnValue([]); 

            preparedCriteria = [
                {
                    key: 'Natural Light', must: true, weight: 100, 
                    regexPatterns: [
                        { regex: /natural light/gi, originalPattern: 'natural light', type: 'primary' },
                        { regex: /sun-drenched/gi, originalPattern: 'sun-drenched', type: 'synonym' }
                    ],
                    primaryPatternString: 'natural light'
                },
                {
                    key: 'Open Kitchen', must: false, weight: 80, 
                    regexPatterns: [
                        { regex: /open kitchen/i, originalPattern: '/open kitchen/i', type: 'primary' }
                    ],
                    primaryPatternString: '/open kitchen/i'
                },
                {
                    key: 'Fuzzy Test', must: false, weight: 50,
                    regexPatterns: [], 
                    primaryPatternString: 'quiet street' 
                }
            ];
        });

        it('should score based on primary pattern match', () => {
            const listingJson = { property_description: 'This home has amazing natural light and an open kitchen.' };
            const score = scoreListing(listingJson, preparedCriteria);
            // Expected: Natural Light (100 * 1.0) + Open Kitchen (80 * 1.0) = 180
            // Total Possible Weight = 100 + 80 + 50 = 230
            // Score = (180 / 230) * 100 = 78.26
            expect(score.alignmentScore).toBeCloseTo( ( (100*CONFIDENCE_LEVELS.PRIMARY) + (80*CONFIDENCE_LEVELS.PRIMARY) ) / 230 * 100, 2);
            expect(score.missingMusts).toEqual([]);
            expect(score.matchedCriteriaKeys).toEqual(expect.arrayContaining(['Natural Light', 'Open Kitchen']));
            expect(score.detailedHits).toEqual(expect.arrayContaining([
                expect.objectContaining({ criterionKey: 'Natural Light', matchType: 'primary', confidence: CONFIDENCE_LEVELS.PRIMARY }),
                expect.objectContaining({ criterionKey: 'Open Kitchen', matchType: 'primary', confidence: CONFIDENCE_LEVELS.PRIMARY })
            ]));
        });

        it('should score based on synonym match', () => {
            const listingJson = { property_description: 'A sun-drenched living room.' };
            const score = scoreListing(listingJson, preparedCriteria);
            // Expected: Natural Light (100 * 0.8) = 80
            // Score = (80 / 230) * 100 = 34.78
            expect(score.alignmentScore).toBeCloseTo( (100*CONFIDENCE_LEVELS.SYNONYM) / 230 * 100, 2);
            expect(score.missingMusts).toEqual([]); // Natural Light is a must but it hit via synonym
            expect(score.matchedCriteriaKeys).toEqual(['Natural Light']);
            expect(score.detailedHits).toEqual(expect.arrayContaining([
                expect.objectContaining({ criterionKey: 'Natural Light', matchType: 'synonym', confidence: 0.7 })
            ]));
        });

        it('should score based on fuzzy match if no regex patterns hit', () => {
            // Make the mock specific for this test case
            mockFastFuzzySearch.mockImplementation((text: string, searchPatterns: string[]) => {
                if (searchPatterns.includes('quiet street')) {
                    return [{ item: 'quiet street', original: 'quiet street', score: 0.7, match: 'a very quiet street'/*, index: X, originalIndex: Y*/ }];
                }
                return []; // No match for other criteria like "natural light" or "/open kitchen/i"
            });

            const listingJson = { property_description: 'A home on a very quiet street.' }; 
            const score = scoreListing(listingJson, preparedCriteria);
            
            expect(mockFastFuzzySearch).toHaveBeenCalledWith('a home on a very quiet street.', ['quiet street'], { returnMatchData: true });
            
            // Expected score calculation remains the same as confidence didn't change, just the threshold
            // Expected: Fuzzy Test (weight 50 * confidence 0.6) = 30
            // Total Possible Weight = 230
            // Score = (30 / 230) * 100 = 13.0434...
            expect(score.alignmentScore).toBeCloseTo(13.04, 2); // Use hardcoded expected value
            expect(score.missingMusts).toEqual(['Natural Light']); 
            expect(score.matchedCriteriaKeys).toEqual(['Fuzzy Test']);
            expect(score.detailedHits).toEqual(expect.arrayContaining([
                expect.objectContaining({ criterionKey: 'Fuzzy Test', matchType: 'fuzzy', confidence: 0.6 })
            ]));
        });

        it('should not count a fuzzy match below the minimum score', () => {
            mockFastFuzzySearch.mockImplementation((text: string, searchPatterns: string[]) => {
                if (searchPatterns.includes('quiet street')) {
                    return [{ item: 'quiet street', original: 'quiet street', score: FUZZY_MATCH_MIN_SCORE - 0.01, match: 'a very quiet street' }];
                }
                return [];
            });

            const listingJson = { property_description: 'A home on a very quiet street.' };
            const score = scoreListing(listingJson, preparedCriteria);

            expect(mockFastFuzzySearch).toHaveBeenCalledWith('a home on a very quiet street.', ['quiet street'], { returnMatchData: true });
            expect(score.matchedCriteriaKeys).not.toContain('Fuzzy Test');
            expect(score.detailedHits.find((h) => h.criterionKey === 'Fuzzy Test')).toBeUndefined();
            expect(score.alignmentScore).toBe(0);
        });

        it('should identify missing must-have criteria', () => {
            const listingJson = { property_description: 'An open kitchen but no mention of light.' };
            const score = scoreListing(listingJson, preparedCriteria);
            expect(score.missingMusts).toEqual(['Natural Light']);
        });

        it('should calculate locationBonus correctly', () => {
            const listingInDolores = { latitude: 37.7598, longitude: -122.4261, address: { zipcode: '94110' } }; // Dolores Heights centroid
            mockTurfDistance.mockReturnValue(0); // Mock distance to be 0 for full bonus
            const score = scoreListing(listingInDolores, preparedCriteria);
            expect(score.locationBonus).toBe(30); // Use hardcoded expected value based on new config
            mockTurfDistance.mockReset();

            const listingNearDolores = { latitude: 37.76, longitude: -122.427, address: { zipcode: '94110' } }; // Slightly off
            mockTurfDistance.mockReturnValue(GEO_PROXIMITY_HALF_BONUS_KM - 0.1); // Inside half bonus radius
            const scoreHalf = scoreListing(listingNearDolores, preparedCriteria);
            expect(scoreHalf.locationBonus).toBeCloseTo(15); // Use hardcoded expected value (30 / 2)
            mockTurfDistance.mockReset();

            const listingFar = { latitude: 37.0, longitude: -122.0, address: { zipcode: '95000'} }; // Far away
            mockTurfDistance.mockReturnValue(GEO_PROXIMITY_HALF_BONUS_KM + 1);
            const scoreFar = scoreListing(listingFar, preparedCriteria);
            expect(scoreFar.locationBonus).toBe(0);
            mockTurfDistance.mockReset();
            
            const listingZipMatchNoCoords = { address: { zipcode: '94110'} }; // No coords, but matching ZIP
            const scoreZip = scoreListing(listingZipMatchNoCoords, preparedCriteria);
            expect(scoreZip.locationBonus).toBe(ZIP_MATCH_BONUS);
        });

        it('should handle listings with no searchable text', () => {
            const listingJson = { property_description: '', features: [] }; // Add empty features for consistency
            const score = scoreListing(listingJson, preparedCriteria);
            expect(score.alignmentScore).toBe(0);
            expect(score.missingMusts).toEqual(expect.arrayContaining(['Natural Light'])); // Assuming Natural Light is still a `must`
            expect(score.matchedCriteriaKeys).toEqual([]);
            expect(score.detailedHits.length).toBe(0);
        });

        // ADDED: Test case for matching features
        it('should score based on match in features array', () => {
            const listingJson = { 
                property_description: 'This home has wonderful views but a small cooking area.', 
                features: ['Stainless Steel Appliances', 'Open Kitchen', 'Hardwood Floors'] 
            };
            const score = scoreListing(listingJson, preparedCriteria);
            // Expected: Open Kitchen (80 * 1.0) = 80
            // Natural Light is missing (must), Fuzzy Test doesn't match
            // Total Possible Weight = 230
            // Score = (80 / 230) * 100 = 34.78
            expect(score.alignmentScore).toBeCloseTo( (80 * CONFIDENCE_LEVELS.PRIMARY) / 230 * 100, 2);
            expect(score.missingMusts).toEqual(['Natural Light']);
            expect(score.matchedCriteriaKeys).toEqual(['Open Kitchen']);
            expect(score.detailedHits).toEqual(expect.arrayContaining([
                expect.objectContaining({ criterionKey: 'Open Kitchen', matchType: 'primary', confidence: CONFIDENCE_LEVELS.PRIMARY })
            ]));
        });
        // END ADDED

        it('should handle criteria list being empty', () => {
            const listingJson = { property_description: 'some text', features: ['some feature'] }; // Add features
            const score = scoreListing(listingJson, []);
            expect(score.alignmentScore).toBe(0);
            expect(score.missingMusts).toEqual([]);
            expect(score.matchedCriteriaKeys).toEqual([]);
            expect(score.detailedHits.length).toBe(0);
            expect(score.locationBonus).toBe(0); // Location bonus is independent of text criteria
        });

    });
}); 