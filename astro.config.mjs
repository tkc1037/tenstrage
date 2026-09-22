// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import rehypeContentMarkers from './src/plugins/rehype-content-markers.mjs';
import rehypeAffiliateLinks from './src/plugins/rehype-affiliate-links.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://takuzo-taxi.com',
  integrations: [sitemap({ filter: (page) => !new URL(page).pathname.startsWith('/start/') })],
  markdown: {
    rehypePlugins: [rehypeContentMarkers, rehypeAffiliateLinks],
  },
});
