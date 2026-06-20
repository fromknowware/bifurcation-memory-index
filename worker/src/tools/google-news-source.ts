/**
 * Google News RSS Source — keyword-based topic polling
 *
 * No API key. Google News exposes free RSS for any search query.
 * We poll a set of RAM/memory-relevant queries and deduplicate by URL.
 */

import type { FeedItem } from './opml-source';

const QUERIES = [
  'DRAM prices',
  'HBM memory chip',
  'memory semiconductor tariff',
  'NAND flash supply',
  'Samsung SK Hynix Micron earnings',
  'DDR5 market',
  'AI memory bandwidth',
  'semiconductor trade policy',
];

const BASE = 'https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q=';

export async function fetchFromGoogleNews(sinceHours = 6): Promise<FeedItem[]> {
  const cutoff = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const seen = new Set<string>();
  const items: FeedItem[] = [];

  await Promise.allSettled(
    QUERIES.map(async (query) => {
      try {
        const url = BASE + encodeURIComponent(query);
        const res = await fetch(url, {
          headers: { 'User-Agent': 'RAM-Index-Feed/1.0' },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return;

        const xml = await res.text();
        const parsed = parseGoogleNewsRss(xml, query, cutoff);

        for (const item of parsed) {
          if (!seen.has(item.url)) {
            seen.add(item.url);
            items.push(item);
          }
        }
      } catch {
        // non-fatal
      }
    }),
  );

  return items;
}

function parseGoogleNewsRss(xml: string, query: string, cutoff: Date): FeedItem[] {
  const items: FeedItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];

    const title = cdataOrText(block, 'title');
    const link = cdataOrText(block, 'link') || extractGoogleLink(block);
    const pubDate = cdataOrText(block, 'pubDate');
    const source = cdataOrText(block, 'source') || 'Google News';
    const description = stripHtml(cdataOrText(block, 'description')).slice(0, 400);

    if (!title || !link) continue;

    const published = pubDate ? new Date(pubDate) : new Date();
    if (published < cutoff) continue;

    items.push({
      id: link,
      title: title.trim(),
      url: link.trim(),
      excerpt: description.trim(),
      source: source.trim(),
      sourceFeed: `google-news:${query}`,
      publishedAt: published.toISOString(),
    });
  }

  return items;
}

// Google News sometimes puts the real URL inside the description or as a redirect.
// The <link> tag in their RSS is the gnews.google.com redirect URL — usable as-is
// since we only store it as an identifier and open link.
function extractGoogleLink(block: string): string {
  const m = block.match(/<link\s*\/?>(.*?)<\/link>/i) || block.match(/<link>(.*?)<\/link>/i);
  return m ? m[1].trim() : '';
}

function cdataOrText(block: string, tag: string): string {
  const re = new RegExp(
    `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`,
    'i',
  );
  const m = block.match(re);
  return m ? (m[1] ?? m[2] ?? '').trim() : '';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
