// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
// The local rating tool. Both parts only switch on during `npm run dev`, never in a build.
import { devRateRoute, devRatings } from './scripts/dev-ratings.mjs';

// https://astro.build/config
export default defineConfig({
  // The public address, like https://popcorn.example. Set SITE_URL in Vercel once you
  // have it. Until then, canonical links and the sitemap are left out rather than guessed.
  site: process.env.SITE_URL || undefined,
  integrations: [react(), devRateRoute()],

  vite: {
    plugins: [tailwindcss(), devRatings()]
  }
});
