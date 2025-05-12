// Temporary script to clear all records from the Score table
import { PrismaClient } from '@prisma/client';

// Instantiate Prisma Client
// It will automatically pick up the DATABASE_URL from the .env file
// in the context where this script is run (e.g., packages/api if run from there,
// or root if .env is there and Prisma client is configured to find it).
const prisma = new PrismaClient();

async function clearAllScores() {
  console.log('Attempting to delete all records from the Score table...');
  try {
    const result = await prisma.score.deleteMany({});
    console.log(`Successfully deleted ${result.count} score records.`);
    console.log('All existing scores have been cleared.');
    console.log('You can now re-run the POST /api/process-scores endpoint to regenerate scores with the latest logic.');
  } catch (error) {
    console.error('Error deleting scores:', error);
    console.error('Please ensure your database is accessible and the Prisma client is configured correctly.');
  } finally {
    await prisma.$disconnect();
    console.log('Prisma client disconnected.');
  }
}

clearAllScores(); 