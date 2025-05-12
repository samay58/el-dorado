# El Dorado Real Estate Platform

This monorepo contains a full-stack real estate platform focused on property scoring, evaluation, and analysis.

## Features

- Property data scraping from Zillow and other sources
- Advanced scoring engine with weighted criteria matching
- Geo-based proximity scoring for preferred neighborhoods
- Interactive property map with clustering
- Valuation engine for property price analysis
- Search and filtering of property listings

## Tech Stack

- **Frontend**: Next.js 14 with App Router, Tailwind CSS, Mapbox GL JS
- **Backend**: Fastify, Prisma ORM, TypeScript
- **Scraping**: ZenRows API with rotating proxies
- **Testing**: Vitest
- **Monorepo**: Turborepo

## Getting Started

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/el-dorado.git
   cd el-dorado
   ```

2. Install dependencies
   ```bash
   pnpm install
   ```

3. Set up environment variables
   - Copy each `.env.example` file to `.env` in the respective directories
   - Fill in your API keys and database connection details

4. Initialize the database
   ```bash
   cd packages/db
   pnpm prisma migrate dev
   pnpm prisma db seed
   ```

5. Run the development server
   ```bash
   pnpm dev
   ```

## Required Environment Variables

The application requires the following environment variables:

- ZENROWS_API_KEY - For web scraping API
- MAPBOX_TOKEN - For interactive maps
- DATABASE_URL - Postgres connection string

## Project Structure

- `apps/web` - Next.js frontend
- `packages/api` - Fastify backend API
- `packages/db` - Prisma schema and database access

## Implementation Status

Refer to the [implementation-checklist.md](./implementation-checklist.md) for the current status of features and the [project-roadmap.md](./project-roadmap.md) for the development plan.