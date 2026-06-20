/**
 * OPML Source — Parse Feedly OPML export and poll constituent RSS feeds
 *
 * Feed the exported Feedly OPML into KV under key "ram_feed:opml"
 * and this tool will discover all feed URLs, poll each one, and
 * return raw items for scoring.
 */

export interface FeedItem {
  id: string;
  title: string;
  url: string;
  excerpt: string;
  source: string;
  sourceFeed: string;
  publishedAt: string;
}

// Feedly categories to skip entirely — zero RAM/macro/tech signal
const CATEGORY_DENYLIST = new Set([
  'xoxo', 'Melodica', 'Projection Mapping', '_gardening', '_type',
  '_design', '_Procedural', '_museums', '⚓️ pleaseBeKind', 'Blockchain',
  '.:: W3B ::.', '_infographic',
]);

export async function fetchFromOpml(
  kv: KVNamespace,
  sinceHours = 24,
): Promise<FeedItem[]> {
  const opmlXml = await kv.get('ram_feed:opml');
  if (!opmlXml) return [];

  const feedUrls = parseOpml(opmlXml, CATEGORY_DENYLIST);
  const cutoff = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const items: FeedItem[] = [];

  await Promise.allSettled(
    feedUrls.map(async ({ url, title: feedTitle }) => {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'RAM-Index-Feed/1.0' },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return;

        const xml = await res.text();
        const parsed = parseRssXml(xml, feedTitle, cutoff);
        items.push(...parsed);
      } catch {
        // individual feed failures are non-fatal
      }
    }),
  );

  return items;
}

// ─── OPML Parser ─────────────────────────────────────────────────

function parseOpml(xml: string, denylist = new Set<string>()): { url: string; title: string }[] {
  const feeds: { url: string; title: string }[] = [];

  // Split by top-level category <outline> blocks so we can check the category name
  const categoryRe = /<outline\s+(?:text|title)="([^"]*)"[^/]>([\s\S]*?)<\/outline>/gi;
  let cat: RegExpExecArray | null;

  while ((cat = categoryRe.exec(xml)) !== null) {
    const categoryName = cat[1];
    if (denylist.has(categoryName)) continue;

    const block = cat[2];
    const feedRe = /<outline[^>]+xmlUrl="([^"]+)"[^>]*(?:title|text)="([^"]*)"/gi;
    let m: RegExpExecArray | null;
    while ((m = feedRe.exec(block)) !== null) {
      if (!feeds.some((f) => f.url === m![1])) {
        feeds.push({ url: m[1], title: m[2] || m[1] });
      }
    }
    // Reversed attribute order
    const feedRe2 = /<outline[^>]+(?:title|text)="([^"]*)"[^>]*xmlUrl="([^"]+)"/gi;
    while ((m = feedRe2.exec(block)) !== null) {
      if (!feeds.some((f) => f.url === m![2])) {
        feeds.push({ url: m[2], title: m[1] || m[2] });
      }
    }
  }

  return feeds;
}

// ─── RSS/Atom Item Extractor ──────────────────────────────────────

function parseRssXml(xml: string, feedTitle: string, cutoff: Date): FeedItem[] {
  const items: FeedItem[] = [];

  // Handles both RSS <item> and Atom <entry>
  const itemRe = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];

    const title = extractTag(block, 'title');
    const link = extractLink(block);
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated');
    const description = stripHtml(
      extractTag(block, 'description') || extractTag(block, 'summary') || extractTag(block, 'content') || '',
    ).slice(0, 400);

    if (!title || !link) continue;

    const published = pubDate ? new Date(pubDate) : new Date();
    if (published < cutoff) continue;

    items.push({
      id: link,
      title: title.trim(),
      url: link.trim(),
      excerpt: description.trim(),
      source: feedTitle,
      sourceFeed: 'opml',
      publishedAt: published.toISOString(),
    });
  }

  return items;
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');
  const m = block.match(re);
  return m ? (m[1] ?? m[2] ?? '').trim() : '';
}

function extractLink(block: string): string {
  // RSS <link>
  const rssLink = block.match(/<link>([^<]+)<\/link>/i);
  if (rssLink) return rssLink[1].trim();
  // Atom <link href="...">
  const atomLink = block.match(/<link[^>]+href="([^"]+)"/i);
  if (atomLink) return atomLink[1].trim();
  // <guid> as fallback
  const guid = block.match(/<guid[^>]*>([^<]+)<\/guid>/i);
  return guid ? guid[1].trim() : '';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
