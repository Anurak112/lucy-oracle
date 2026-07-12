// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// Project page: https://anurak112.github.io/lucy-oracle/
export default defineConfig({
  site: 'https://anurak112.github.io',
  base: '/lucy-oracle',
  trailingSlash: 'ignore',

  build: {
    inlineStylesheets: 'auto',
  },

  compressHTML: true,
  integrations: [react()],
});