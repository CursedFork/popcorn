// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // The public address, like https://popcorn.example. Set SITE_URL in Vercel once you
  // have it. Until then, canonical links and the sitemap are left out rather than guessed.
  site: process.env.SITE_URL || undefined,
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()]
  }
});
