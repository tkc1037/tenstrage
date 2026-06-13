import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).default([]),
    author: z.string().default('Takuzo'),
    reviewStatus: z.enum(['draft', 'review', 'approved', 'published']).default('draft'),
    factChecked: z.boolean().default(false),
    sources: z.array(z.string()).default([]),
    heroImage: z.string().optional(),
    canonical: z.string().optional(),
    draft: z.boolean().default(false),
    noindex: z.boolean().default(false),
  }),
});

export const collections = { articles };
