import { defineCollection, z } from 'astro:content';

const articles = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).default([]),
    author: z.string().default('Takuzo'),
    heroImage: z.string().optional(),
    reviewStatus: z.string().optional(),
    factChecked: z.boolean().optional(),
    sources: z.array(z.string()).default([]),
    canonical: z.string().optional(),
    noindex: z.boolean().optional(),
    draft: z.boolean().default(true),
  }),
});

export const collections = { articles };
