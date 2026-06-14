// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import rehypeContentMarkers from './src/plugins/rehype-content-markers.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://tenstrage.pages.dev',
  integrations: [sitemap()],
  markdown: {
    rehypePlugins: [rehypeContentMarkers],
  },
});
