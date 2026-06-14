import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const articles = await getCollection('articles', ({ data }) => !data.draft);
  articles.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  return rss({
    title: 'TAKUZO TAXI｜東京タクシー転職ノート',
    description: '東京でタクシー転職を考える人が、収入・勤務・会社選びを誇張なしで判断できる場所。',
    site: context.site!,
    items: articles.map((article) => ({
      title: article.data.title,
      pubDate: article.data.pubDate,
      description: article.data.description,
      link: `/articles/${article.id}/`,
      ...(article.data.author && { author: article.data.author }),
    })),
    customData: '<language>ja</language>',
  });
}
