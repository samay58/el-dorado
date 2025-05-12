import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths'; // For resolving TS paths if used
import { URL } from 'node:url'; // Import URL for path resolution

export default defineConfig({
  plugins: [
    tsconfigPaths(), // This plugin helps resolve paths defined in tsconfig.json
  ],
  test: {
    globals: true, // Optional: to use Vitest globals like describe, it, expect without importing
    environment: 'node', // Or 'jsdom' if testing frontend components
    // setupFiles: './vitest.setup.ts', // If you need global setup for tests
    // coverage: { // Optional: for coverage reports
    //   provider: 'v8',
    //   reporter: ['text', 'json', 'html'],
    // },
  },
  // Resolve workspace packages. This is often needed in monorepos.
  // This tells Vite/Vitest to look for these packages as if they were normally installed.
  // It relies on pnpm's symlinking of workspace packages into node_modules.
  resolve: {
    alias: {
      // Explicitly alias workspace packages for Vitest/Vite
      // Adjust the path if your main export from @my-real-estate-app/db is different
      '@my-real-estate-app/db': new URL('./packages/db/src/index.ts', import.meta.url).pathname,
      // If you had other local packages, you'd add them similarly:
      // '@my-real-estate-app/utils': new URL('./packages/utils/src/index.ts', import.meta.url).pathname,
      // This might not be strictly necessary if pnpm workspaces are correctly linked
      // and if the packages themselves have correct main/module/types fields.
      // However, explicitly adding it can help if resolution fails.
      // Example: '@my-real-estate-app/db': new URL('./packages/db/src', import.meta.url).pathname, // Adjust path to where your compiled output or source is
    },
    // Ensure Vite can resolve dependencies from the monorepo root node_modules
    // and also from individual package node_modules (though pnpm usually handles this well)
    // dedupe: ['react', 'react-dom'], // Example if you had frontend deps
  },
}); 