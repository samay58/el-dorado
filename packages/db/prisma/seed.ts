import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding criteria ...`);

  // Clear existing criteria to prevent duplicates if IDs change or criteria are removed
  // Note: In a production scenario, you might want a more sophisticated update mechanism
  // or ensure IDs are stable and use upsert carefully.
  // For development and this seed script, deleting and re-adding is straightforward.
  await prisma.criterion.deleteMany({});
  console.log('Cleared existing criteria.');

  const criteriaData = [
    // Property Features
    {
      id: 'cl_natural_light',
      key: 'Natural Light',
      weight: 100,
      must: true,
      pattern: 'natural light',
      synonyms: ['sun-drenched', 'bright interiors', 'abundant sunlight', 'sunlit', 'well-lit', 'lots of light'],
    },
    {
      id: 'cl_in_unit_laundry',
      key: 'In-Unit Laundry',
      weight: 90,
      must: true,
      pattern: '/in[-\\s]?unit laundry/i', // Explicit regex
      synonyms: ['washer/dryer in unit', 'laundry hookups in unit', 'in-home laundry'],
    },
    {
      id: 'cl_dishwasher',
      key: 'Dishwasher',
      weight: 80,
      must: true,
      pattern: 'dishwasher',
      synonyms: ['dish washer'], // Common variation
    },
    {
      id: 'cl_high_ceilings',
      key: 'High Ceilings',
      weight: 70,
      must: false,
      pattern: 'high ceilings',
      synonyms: ['tall ceilings', 'vaulted ceilings', 'lofty ceilings'],
    },
    {
      id: 'cl_modern_appliances',
      key: 'Modern Appliances',
      weight: 60,
      must: false,
      pattern: 'modern appliances',
      synonyms: ['updated appliances', 'new appliances', 'stainless steel appliances', 'high-end appliances'],
    },
    {
      id: 'cl_open_floor_plan',
      key: 'Open Floor Plan',
      weight: 65,
      must: false,
      pattern: 'open floor plan',
      synonyms: ['open concept', 'open layout', 'great room'],
    },
    {
      id: 'cl_separate_office',
      key: 'Separate Office Space',
      weight: 55,
      must: false,
      pattern: '/separate\\s+(office|study)/i', // Explicit regex
      synonyms: ['home office', 'den', 'dedicated workspace', 'study nook'],
    },
    {
      id: 'cl_ac',
      key: 'Air Conditioning',
      weight: 40,
      must: false,
      pattern: 'air conditioning|A/C',
      synonyms: ['central air', 'AC unit', 'climate control'],
    },
    // Outdoor and Natural Elements
    {
      id: 'cl_outdoor_space',
      key: 'Outdoor Space',
      weight: 50,
      must: false,
      pattern: 'balcony|patio|outdoor space',
      synonyms: ['deck', 'yard', 'garden', 'terrace', 'private outdoor'],
    },
    {
      id: 'cl_proximity_nature',
      key: 'Proximity to Nature',
      weight: 60,
      must: false,
      pattern: 'near park|green space|close to nature',
      synonyms: ['park access', 'adjacent to trails', 'nature views'],
    },
    // Pet and Accessibility Considerations
    {
      id: 'cl_pet_friendly',
      key: 'Pet-Friendly',
      weight: 80,
      must: true,
      pattern: '/pet[-\\s]?friendly|allows cats/i', // Explicit regex for the whole OR group
      synonyms: ['pets allowed', 'dogs welcome', 'cat friendly'],
    },
    {
      id: 'cl_elevator_access',
      key: 'Elevator Access',
      weight: 50,
      must: false,
      pattern: 'elevator access|has elevator',
      synonyms: ['lift access'],
    },
    {
      id: 'cl_minimal_stairs',
      key: 'Minimal Stairs',
      weight: 45,
      must: false,
      pattern: 'minimal stairs|no stairs|ground floor',
      synonyms: ['single-level living', 'step-free access', 'first floor unit'],
    },
    // Parking and Transportation
    {
      id: 'cl_parking',
      key: 'Parking Availability',
      weight: 70,
      must: false,
      pattern: '/parking\\s+(spot|available)|garage/i', // Explicit regex
      synonyms: ['dedicated parking', 'off-street parking', 'parking included'],
    },
    {
      id: 'cl_public_transport',
      key: 'Proximity to Public Transport',
      weight: 50,
      must: false,
      pattern: '/near\\s+(Muni|BART|public transport)/i', // Explicit regex
      synonyms: ['transit-friendly', 'easy commute', 'close to bus lines'],
    },
    // Neighborhood Preferences - Synonyms might not be as relevant here if pattern is just the name
    // but could be used for common abbreviations or alternative names if any.
    {
      id: 'cl_dolores_heights',
      key: 'Located in Dolores Heights',
      weight: 90,
      must: false,
      pattern: 'Dolores Heights',
      synonyms: [],
    },
    {
      id: 'cl_potrero_hill',
      key: 'Located in Potrero Hill',
      weight: 85,
      must: false,
      pattern: 'Potrero Hill',
      synonyms: [],
    },
    {
      id: 'cl_noe_valley',
      key: 'Located in Noe Valley',
      weight: 80,
      must: false,
      pattern: 'Noe Valley',
      synonyms: [],
    },
    {
      id: 'cl_marina',
      key: 'Located in Marina District',
      weight: 75,
      must: false,
      pattern: 'Marina District',
      synonyms: [],
    },
    {
      id: 'cl_pacific_heights',
      key: 'Located in Pacific Heights',
      weight: 70,
      must: false,
      pattern: 'Pacific Heights',
      synonyms: ['Pac Heights'], // Example abbreviation
    },
    {
      id: 'cl_north_beach',
      key: 'Located in North Beach',
      weight: 65,
      must: false,
      pattern: 'North Beach',
      synonyms: [],
    },
    // Noise Considerations
    {
      id: 'cl_quiet_street',
      key: 'Quiet Street',
      weight: 60,
      must: false,
      pattern: 'quiet street|low noise',
      synonyms: ['peaceful location', 'tranquil setting', 'away from traffic'],
    },
  ];

  for (const crit of criteriaData) {
    // Using create instead of upsert after deleteMany to ensure fresh insert with potentially new IDs if any were changed
    const criterion = await prisma.criterion.create({
      data: crit,
    });
    console.log(`Created criterion with id: ${criterion.id} (${criterion.key})`);
  }

  console.log(`Seeding finished.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 