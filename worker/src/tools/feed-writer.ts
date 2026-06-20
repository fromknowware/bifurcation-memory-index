/**
 * Feed Writer — renders scored items as Atom XML and commits to GitHub Pages
 *
 * Output: bifurcation-memory-index/docs/feed.xml
 * Served at: https://ram-index.com/feed.xml (via CNAME on GitHub Pages)
 *
 * Keeps a rolling window of the 50 most recent items across runs.
 * Existing feed is read from GitHub, new items are prepended, then committed.
 */

import type { ScoredItem } from './relevance-scorer';
import { classifyItem, FeedTag } from './classifier';
import { sanitizeTitle, sanitizeExcerpt, isItemCorrupted } from './sanitize';

const FEED_META = {
  title: 'The RAM Index — Memory Market Intelligence',
  subtitle: 'DRAM prices, semiconductor trade, and macroeconomic signals curated by The Ramification Index.',
  siteUrl: 'https://ram-index.com',
  feedUrl: 'https://ram-index.com/feed.xml',
  author: 'Khayyam Wakil / The ARC Institute of Knowware',
  maxItems: 100,
};

const GITHUB_FILE_PATH = 'docs/feed.xml';

export async function writeFeed(
  newItems: ScoredItem[],
  githubToken: string,
  githubOwner: string,
  githubRepo: string,
): Promise<{ committed: number; total: number }> {
  if (newItems.length === 0) return { committed: 0, total: 0 };

  // ─── Fetch existing feed from GitHub ──────────────────────────
  const existing = await fetchExistingItems(githubToken, githubOwner, githubRepo);
  const existingUrls = new Set(existing.map((i) => i.url));

  // Deduplicate and sanitize incoming items before they touch the feed
  const fresh = newItems
    .filter((i) => !existingUrls.has(i.url))
    .map((i) => ({ ...i, title: sanitizeTitle(i.title), excerpt: sanitizeExcerpt(i.excerpt) }))
    .filter((i) => !isItemCorrupted(i.title, i.excerpt));
  if (fresh.length === 0) return { committed: 0, total: existing.length };

  // Merge, sort by date desc, cap at maxItems
  const allItems = [...fresh, ...existing]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, FEED_META.maxItems);

  const xml = renderAtom(allItems);

  // ─── Commit to GitHub ──────────────────────────────────────────
  await commitFeed(xml, githubToken, githubOwner, githubRepo);

  return { committed: fresh.length, total: allItems.length };
}

// ─── Atom XML Renderer ────────────────────────────────────────────

export function renderAtom(items: StoredItem[]): string {
  const updated = items[0]?.publishedAt ?? new Date().toISOString();

  const entries = items.map((item) => `
  <entry>
    <id>${esc(item.url)}</id>
    <title type="html">${esc(item.title)}</title>
    <link href="${esc(item.url)}" />
    <updated>${item.publishedAt}</updated>
    <author><name>${esc(item.source)}</name></author>
    <summary type="html">${esc(
      item.excerpt +
      (item.riImplication ? ` RI implication: ${item.riImplication}` : ''),
    )}</summary>
    <category term="${esc(item.sourceFeed)}" />
    ${item.tag ? `<category term="tag:${item.tag}" />` : ''}
    ${item.editorialPick ? '<category term="editorial-pick" />' : ''}
    <content type="html">${esc(
      `<p>${item.excerpt}</p>` +
      (item.riImplication ? `<p><em>RI implication: ${item.riImplication}</em></p>` : '') +
      (item.editorialPick ? `<p><em>Editorial pick — curated by The RAM Index.</em></p>` : `<p><em>Signal score: ${item.signal}/10 — ${item.reasoning}</em></p>`),
    )}</content>
  </entry>`).join('');

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${FEED_META.feedUrl}</id>
  <title>${FEED_META.title}</title>
  <subtitle>${FEED_META.subtitle}</subtitle>
  <link href="${FEED_META.feedUrl}" rel="self" />
  <link href="${FEED_META.siteUrl}" />
  <updated>${updated}</updated>
  <author><name>${FEED_META.author}</name></author>
  <rights>CC BY 4.0 — The ARC Institute of Knowware</rights>
${entries}
</feed>`;
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── GitHub API Helpers ───────────────────────────────────────────

export interface StoredItem {
  id?: string;
  url: string;
  title: string;
  excerpt: string;
  source: string;
  sourceFeed: string;
  publishedAt: string;
  signal: number;
  reasoning: string;
  riImplication?: string;
  tag?: FeedTag;
  editorialPick?: boolean;
}

export async function fetchExistingItems(
  token: string,
  owner: string,
  repo: string,
): Promise<StoredItem[]> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_FILE_PATH}`,
      { headers: githubHeaders(token) },
    );
    if (!res.ok) return [];

    const data = await res.json() as { content: string };
    const bytes = Uint8Array.from(atob(data.content.replace(/\n/g, '')), c => c.charCodeAt(0));
    const xml = new TextDecoder('utf-8').decode(bytes);
    return parseAtomItems(xml);
  } catch {
    return [];
  }
}

function parseAtomItems(xml: string): StoredItem[] {
  const items: StoredItem[] = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null;

  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[1];
    const url = (block.match(/<link href="([^"]+)"/) ?? [])[1] ?? '';
    const title = unesc((block.match(/<title[^>]*>([\s\S]*?)<\/title>/) ?? [])[1] ?? '');
    const summary = unesc((block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/) ?? [])[1] ?? '');
    const source = unesc((block.match(/<name>([\s\S]*?)<\/name>/) ?? [])[1] ?? '');
    const published = (block.match(/<updated>([\s\S]*?)<\/updated>/) ?? [])[1] ?? '';
    const categories = [...block.matchAll(/<category term="([^"]+)"/g)].map((c) => c[1]);
    const editorialPick = categories.includes('editorial-pick');
    const tagCat = categories.find((c) => c.startsWith('tag:'));
    const tag = tagCat ? (tagCat.slice(4) as FeedTag) : classifyItem(title, summary);
    const sourceFeed = categories.find((c) => c !== 'editorial-pick' && !c.startsWith('tag:')) ?? '';

    // Check corruption on raw text before sanitizing — sanitize truncates, masking length signal
    if (url && !isItemCorrupted(title, summary)) {
      items.push({ url, title: sanitizeTitle(title), excerpt: sanitizeExcerpt(summary), source, sourceFeed, publishedAt: published, signal: 0, reasoning: '', tag, editorialPick });
    }
  }
  return items;
}

function unesc(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

export async function commitFeed(
  xml: string,
  token: string,
  owner: string,
  repo: string,
): Promise<void> {
  // Get current file SHA (needed for update)
  const shaRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_FILE_PATH}`,
    { headers: githubHeaders(token) },
  );
  const sha = shaRes.ok ? ((await shaRes.json()) as { sha: string }).sha : undefined;

  const body: Record<string, unknown> = {
    message: `feed: update RAM Index feed [${new Date().toISOString().slice(0, 10)}]`,
    content: btoa(unescape(encodeURIComponent(xml))),
    branch: 'main',
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_FILE_PATH}`,
    {
      method: 'PUT',
      headers: githubHeaders(token),
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub commit failed: ${res.status} ${err}`);
  }
}

function githubHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'RAM-Index-Feed/1.0',
  };
}
