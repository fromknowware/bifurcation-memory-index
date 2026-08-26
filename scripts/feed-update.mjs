#!/usr/bin/env node
/**
 * feed-update.mjs — The RAM Index feed updater (dependency-free, Node 18+)
 *
 * Replaces the retired Cloudflare Worker pipeline. Runs on GitHub Actions
 * every 6 hours (see .github/workflows/update-feed.yml) or locally:
 *
 *   node scripts/feed-update.mjs [--dry-run] [--since-hours 24]
 *
 * Sources (all optional, graceful degradation):
 *   1. Google News RSS     — public, no key. Curated DRAM/HBM/macro queries.
 *   2. OPML feeds          — scripts/feeds.opml, polled for fresh items.
 *   3. Raindrop dropbox    — needs RAINDROP_API_TOKEN + RAINDROP_COLLECTION_ID.
 *                            Items you bookmark there become editorial PICKs.
 *
 * Scoring is deterministic (no LLM): items are classified by the same rule
 * engine the worker used, and each tag gets a fixed RI implication sentence.
 *
 * Output: docs/feed.xml (Atom, same schema the front-end parses) with:
 *   - feed-level <updated> = generation time (honest heartbeat for the UI)
 *   - item URLs cleaned of Google/UTM tracking params
 *   - duplicates collapsed (normalized URL, then normalized title+source)
 *   - mojibake/corruption sanitized
 *
 * Environment:
 *   RAINDROP_API_TOKEN      optional — enables the editorial dropbox
 *   RAINDROP_COLLECTION_ID  optional — defaults to 71684447
 *   GOOGLE_NEWS_ENABLED     optional — "0" disables the Google News sweep
 *   FEED_SINCE_HOURS        optional — lookback window (default 24)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { storyUrl } from './lib/slug.mjs';
import { cleanUrl } from './lib/url.mjs';
export { cleanUrl };
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const FEED = resolve(ROOT, 'docs/feed.xml');
const OPML = resolve(ROOT, process.env.FEED_OPML || 'scripts/feeds.opml');

const DRY_RUN = process.argv.includes('--dry-run');
const _sinceFlag = process.argv.indexOf('--since-hours');
const _sinceArg = _sinceFlag >= 0 ? process.argv[_sinceFlag + 1] : '';
function _hours(v) { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : 24; }
const SINCE_HOURS = _hours(process.env.FEED_SINCE_HOURS || _sinceArg || '24');
const CUTOFF = new Date(Date.now() - SINCE_HOURS * 60 * 60 * 1000);

const FEED_META = {
  title: 'The RAM Index — Memory Market Intelligence',
  subtitle: 'DRAM prices, semiconductor trade, and macroeconomic signals curated by The Ramification Index.',
  siteUrl: 'https://ram-index.com',
  feedUrl: 'https://ram-index.com/feed.xml',
  author: 'Khayyam Wakil / The ARC Institute of Knowware',
  maxItems: 10000,
};

// ── URL hygiene ──────────────────────────────────────────────────────


/** Stable dedup key: cleaned URL, else normalized title+source. */
export function dedupKey(item) {
  const url = cleanUrl(item.url);
  if (url && url.length > 10) return 'u:' + url;
  return 't:' + (item.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '') + '|' + (item.source || '').toLowerCase();
}

// ── Sanitizer (ported from worker/src/tools/sanitize.ts) ────────────

const MAX_TITLE = 300;
const MAX_EXCERPT = 1200;
const CORRUPTION_THRESHOLD = 0.05;

function isCorrupted(text) {
  if (!text) return false;
  const garbage = (text.match(/[ÃÂ]/g) ?? []).length;
  return text.length > 20 && garbage / text.length > CORRUPTION_THRESHOLD;
}

function tryFixDoubleEncoded(text) {
  try {
    const bytes = Uint8Array.from(text, c => c.charCodeAt(0) & 0xff);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return text;
  }
}

function stripControls(text) {
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

export function sanitizeTitle(text) {
  let s = stripControls(text ?? '');
  if (isCorrupted(s)) {
    const fixed = tryFixDoubleEncoded(s);
    s = isCorrupted(fixed) ? s.replace(/[ÃÂ�]/g, '').replace(/\s{2,}/g, ' ').trim() : fixed;
  }
  return s.slice(0, MAX_TITLE).trim();
}

export function sanitizeExcerpt(text) {
  let s = stripControls(text ?? '');
  if (isCorrupted(s)) {
    const fixed = tryFixDoubleEncoded(s);
    s = isCorrupted(fixed) ? s.replace(/[ÃÂ�]/g, '').replace(/\s{2,}/g, ' ').trim() : fixed;
  }
  return s.slice(0, MAX_EXCERPT).trim();
}

// ── Classifier (ported from worker/src/tools/classifier.ts) ─────────

const RULES = [
  { tag: 'fab', patterns: [
    /\b(wafer|fab(rication)?|yield|nm[ -]?node|\d+nm|\d+a[ -]?node|foundry|tsmc|imec|cleanroom|lithograph|euv|duvr?|ramp.{0,20}(produc|capac)|new.{0,20}(plant|facility)|pyeongtaek|hiroshima|boise|fab\d+|p\d+\s+fab)\b/i,
    /\b(capacity.{0,30}delay|delay.{0,30}(ramp|produc)|mass.{0,15}produc|process.{0,20}node|1[abc]-nm|1[abc]nm)\b/i,
  ]},
  { tag: 'earnings', patterns: [
    /\b(earnings?|quarterly\s+results?|q[1-4]\s+20\d\d|fy20\d\d|guidance|revenue|operating\s+(margin|income|profit)|net\s+(income|profit|loss)|eps|beat|miss(ed)?.{0,15}(estimate|consensus)|margin\s+expand|margin\s+compress)\b/i,
    /\b(annual\s+report|full.year\s+results?|preliminary\s+results?|profit\s+warning|earnings\s+call|investor\s+day)\b/i,
  ]},
  { tag: 'macro', patterns: [
    /\b(gdp|gross\s+domestic|recession|inflation|cpi|ppi|fomc|federal\s+(reserve|funds)|interest\s+rate|tariff|trade\s+(war|policy|deal|deficit)|sanctions|export\s+(control|ban|restrict)|import\s+(duty|tariff)|macro(economic)?|stagflat|unemployment|job(s)?\s+report|nonfarm|ism\s+manufactur)\b/i,
    /\b(bea\s+revise|advance\s+(gdp|estimate)|flash\s+(gdp|pmi)|consensus\s+forecast|central\s+bank|rate\s+(hike|cut|pause)|quantitative)\b/i,
  ]},
  { tag: 'demand', patterns: [
    /\b(hbm|high.bandwidth.memory|ai\s+(memory|chip|server|infra|demand|workload)|gpu\s+(demand|supply|shortage)|data\s+cent(er|re)|hyperscal|inference|training\s+(cluster|demand)|blackwell|hopper|gb\d{3}|nvl\d+|rack.{0,20}(demand|deploy)|allocation.{0,20}lock|memory.{0,20}(ai|bandwidth))\b/i,
    /\b(nvidia|amd.{0,20}(mi\d+|instinct)|intel.{0,20}gaudi|tpu|xpu|accelerat.{0,20}(demand|adopt)|cloud.{0,20}(capex|spend|invest))\b/i,
  ]},
  { tag: 'supply', patterns: [/.*/] },
];

export function classifyItem(title, excerpt) {
  const haystack = `${title} ${excerpt}`.toLowerCase();
  for (const rule of RULES) {
    if (rule.patterns.some(p => p.test(haystack))) return rule.tag;
  }
  return 'supply';
}

// ── Deterministic scoring (replaces the LLM gate) ───────────────────

const SIGNAL_BY_TAG = { supply: 8, fab: 8, demand: 7, earnings: 7, macro: 6 };
const IMPLICATION_BY_TAG = {
  supply:   'Signals tightening commodity DRAM supply, supportive of R_C and the composite Ramification Index.',
  fab:      'Capacity reallocation toward HBM supports the supply-side bifurcation thesis behind the index.',
  demand:   'Adds to AI/HBM demand evidence diverting capacity from commodity DRAM, widening the bifurcation.',
  earnings: 'Earnings guidance from memory producers supplies the ASP inputs the Ramification Index is built on.',
  macro:    'Provides macro context for judging whether the current RI surge is expansionary or contractionary.',
};

// ── Deterministic relevance gate (mirrors the old LLM "signal >= 6") ──
//
// Without an LLM we gate on term structure instead of semantics:
//   - STRONG terms alone carry the topic (DRAM, HBM, Micron, tariff, ...)
//   - otherwise a DOMAIN term must co-occur with a SIGNAL term in the title
//   - macro terms (GDP, recession, Fed, ...) are always relevant
// Editorial picks bypass the gate. Google News items get one extra escape
// hatch via their excerpt, since the query already constrained the topic.

const STRONG_RE = new RegExp([
  '\\b(dram|hbm|nand|ssd|flash memory|ddr4|ddr5|lpddr|sk hynix|hynix|micron|tsmc|foundry|wafer|euv|lithograph|co-?wos|semiconductor|tariff|export control|chips act|data ?cent(er|re)|hyperscaler|blackwell|h100|h200|b200|hopper|instinct|mi300|ramageddon|memory market|memory prices?)\\b'
].join(''), 'i');

const DOMAIN_RE = /\b(memory|ram|chip|chips|silicon|server|storage|gpu|fab|flash|ssd)\b/i;
const SIGNAL_RE = /\b(price|pricing|supply|demand|capacity|shortage|surge|hike|earnings|revenue|guidance|margin|profit|ai|nvidia|intel|amd|samsung|trade|policy|inflation|gdp|recession|inventory|production|ramp|allocation|sold out|out of stock)\b/i;
const MACRO_RE = /\b(gdp|recession|inflation|cpi|ppi|fomc|federal reserve|interest rate|tariff|trade war|export control|unemployment|stagflation|manufacturing pmi|ism manufacturing|central bank|fiscal)\b/i;

function isRelevant(item) {
  if (item.editorialPick) return true;
  const title = item.title || '';
  const text = title + ' ' + (item.excerpt || '').slice(0, 300);
  if (STRONG_RE.test(title)) return true;
  if (MACRO_RE.test(title)) return true;
  if (DOMAIN_RE.test(title) && SIGNAL_RE.test(title)) return true;
  // Google News items get an excerpt escape hatch (query already topical)
  if ((item.sourceFeed || '').startsWith('google-news') && STRONG_RE.test(text)) return true;
  // Co-occurrence of a memory-domain term with macro context in the body
  if (MACRO_RE.test(text) && STRONG_RE.test(text)) return true;
  return false;
}

function scoreItem(item) {
  const tag = classifyItem(item.title, item.excerpt);
  return {
    ...item,
    tag,
    signal: item.editorialPick ? 10 : SIGNAL_BY_TAG[tag] ?? 6,
    reasoning: item.editorialPick ? 'Editorial pick' : `Deterministic ${tag.toUpperCase()} signal from curated sources`,
    riImplication: item.editorialPick ? '' : IMPLICATION_BY_TAG[tag],
  };
}

// ── Source: Google News RSS (public, no key) ────────────────────────

const GN_QUERIES = [
  'DRAM prices', 'HBM memory chip', 'memory semiconductor tariff',
  'NAND flash supply', 'Samsung SK Hynix Micron earnings', 'DDR5 market',
  'AI memory bandwidth', 'semiconductor trade policy',
];

async function fetchGoogleNews() {
  const base = 'https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q=';
  const items = [];
  const seen = new Set();
  await Promise.allSettled(GN_QUERIES.map(async (query) => {
    try {
      const res = await fetch(base + encodeURIComponent(query), {
        headers: { 'User-Agent': 'RAM-Index-Feed/1.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return;
      const xml = await res.text();
      const itemRe = /<item>([\s\S]*?)<\/item>/gi;
      let m;
      while ((m = itemRe.exec(xml)) !== null) {
        const block = m[1];
        const title = extractTag(block, 'title');
        const link = extractTag(block, 'link');
        const pubDate = extractTag(block, 'pubDate');
        const source = extractTag(block, 'source') || 'Google News';
        const description = stripHtml(extractTag(block, 'description')).slice(0, 400);
        if (!title || !link) continue;
        const published = pubDate ? new Date(pubDate) : new Date();
        if (published < CUTOFF) continue;
        const key = link;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({
          title: title.trim(), url: link.trim(), excerpt: description.trim(),
          source: source.trim(), sourceFeed: `google-news:${query}`,
          publishedAt: published.toISOString(),
        });
      }
    } catch { /* non-fatal */ }
  }));
  return items;
}

// ── Source: OPML feeds ──────────────────────────────────────────────

const CATEGORY_DENYLIST = new Set([
  'xoxo', 'Melodica', 'Projection Mapping', '_gardening', '_type',
  '_design', '_Procedural', '_museums', 'Blockchain', '.:: W3B ::.', '_infographic',
]);

export function parseOpml(xml) {
  const feeds = [];
  const categoryRe = /<outline\s+(?:text|title)="([^"]*)"[^>]*>([\s\S]*?)<\/outline>/gi;
  let cat;
  while ((cat = categoryRe.exec(xml)) !== null) {
    if (CATEGORY_DENYLIST.has(cat[1])) continue;
    for (const re of [
      /<outline[^>]+xmlUrl="([^"]+)"[^>]*(?:title|text)="([^"]*)"/gi,
      /<outline[^>]+(?:title|text)="([^"]*)"[^>]*xmlUrl="([^"]+)"/gi,
    ]) {
      let m;
      while ((m = re.exec(cat[2])) !== null) {
        const url = m[2] || m[1];
        const title = m[1] || m[2];
        if (!feeds.some(f => f.url === url)) feeds.push({ url, title });
      }
    }
  }
  return feeds;
}

async function fetchOpml() {
  if (!existsSync(OPML)) return [];
  const feeds = parseOpml(readFileSync(OPML, 'utf8'));
  const items = [];
  await Promise.allSettled(feeds.map(async ({ url, title: feedTitle }) => {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'RAM-Index-Feed/1.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return;
      const xml = await res.text();
      const itemRe = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi;
      let m;
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
        if (published < CUTOFF) continue;
        items.push({
          title: title.trim(), url: link.trim(), excerpt: description.trim(),
          source: feedTitle, sourceFeed: 'opml',
          publishedAt: published.toISOString(),
        });
      }
    } catch { /* non-fatal */ }
  }));
  return items;
}

// ── Source: Raindrop dropbox (editorial picks) ──────────────────────

async function fetchRaindrop() {
  const token = process.env.RAINDROP_API_TOKEN;
  const collectionId = process.env.RAINDROP_COLLECTION_ID || '71684447';
  if (!token) return [];
  try {
    const url = `https://api.raindrop.io/rest/v1/raindrops/${collectionId}?` +
      new URLSearchParams({ sort: '-created', perpage: '50' });
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Raindrop API error: ${res.status} ${res.statusText}`);
    const data = await res.json();
    return data.items.map((item) => ({
      title: item.title, url: item.link, excerpt: item.excerpt || '',
      source: item.domain || 'Raindrop', sourceFeed: 'raindrop',
      publishedAt: item.created, editorialPick: true,
    }));
  } catch (e) {
    console.warn(`  raindrop: ${e.message}`);
    return [];
  }
}

// ── Shared XML helpers ──────────────────────────────────────────────

function extractTag(block, tag) {
  const re = new RegExp(
    `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');
  const m = block.match(re);
  return m ? (m[1] ?? m[2] ?? '').trim() : '';
}

function extractLink(block) {
  const rssLink = block.match(/<link>([^<]+)<\/link>/i);
  if (rssLink) return rssLink[1].trim();
  const atomLink = block.match(/<link[^>]+href="([^"]+)"/i);
  if (atomLink) return atomLink[1].trim();
  const guid = block.match(/<guid[^>]*>([^<]+)<\/guid>/i);
  return guid ? guid[1].trim() : '';
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function unesc(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Existing feed parse ─────────────────────────────────────────────

export function parseFeed(xml) {
  const items = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/gi;
  let m;
  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[1];
    const url = (block.match(/<link href="([^"]+)"/) ?? [])[1] ?? '';
    const title = unesc((block.match(/<title[^>]*>([\s\S]*?)<\/title>/) ?? [])[1] ?? '');
    const summary = unesc((block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/) ?? [])[1] ?? '');
    const source = unesc((block.match(/<name>([\s\S]*?)<\/name>/) ?? [])[1] ?? '');
    const publishedAt = (block.match(/<updated>([\s\S]*?)<\/updated>/) ?? [])[1] ?? '';
    const cats = [...block.matchAll(/<category term="([^"]+)"/g)].map(c => c[1]);
    const editorialPick = cats.includes('editorial-pick');
    const tagCat = cats.find(c => c.startsWith('tag:'));
    const tag = tagCat ? tagCat.slice(4) : classifyItem(title, summary);
    const sourceFeed = cats.find(c => c !== 'editorial-pick' && !c.startsWith('tag:')) ?? '';

    // Extract existing RI implication from the summary (idempotent re-render)
    const riSplit = summary.indexOf(' RI implication: ');
    const excerpt = riSplit >= 0 ? summary.slice(0, riSplit) : summary;
    const riImplication = riSplit >= 0 ? summary.slice(riSplit + 17) : '';

    if (!url) continue;
    items.push({
      url, title: sanitizeTitle(title), excerpt: sanitizeExcerpt(excerpt),
      source, sourceFeed, publishedAt,
      tag: classifyItem(title, excerpt),
      editorialPick, riImplication,
      signal: editorialPick ? 10 : SIGNAL_BY_TAG[tag] ?? 6,
      reasoning: editorialPick ? 'Editorial pick' : 'Existing feed item',
    });
  }
  return items;
}

// ── Atom renderer (same schema the front-end parses) ────────────────

function renderAtom(items, generatedAt) {
  const entries = items.map((item) => `
  <entry>
    <id>${esc(cleanUrl(item.url))}</id>
    <title type="html">${esc(item.title)}</title>
    <link href="${esc(cleanUrl(item.url))}" />
    <link rel="related" href="${storyUrl(item)}" />
    <updated>${item.publishedAt}</updated>
    <author><name>${esc(item.source)}</name></author>
    <summary type="html">${esc(
      item.excerpt +
      (item.riImplication ? ` RI implication: ${item.riImplication}` : ''),
    )}</summary>
    <category term="${esc(item.sourceFeed || 'feed')}" />
    ${item.tag ? `<category term="tag:${esc(item.tag)}" />` : ''}
    ${item.editorialPick ? '<category term="editorial-pick" />' : ''}
    <content type="html">${esc(
      `<p>${item.excerpt}</p>` +
      (item.riImplication ? `<p><em>RI implication: ${item.riImplication}</em></p>` : '') +
      (item.editorialPick
        ? `<p><em>Editorial pick — curated by The RAM Index.</em></p>`
        : `<p><em>Signal score: ${item.signal}/10 — ${item.reasoning}</em></p>`),
    )}</content>
  </entry>`).join('');

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${FEED_META.feedUrl}</id>
  <title>${FEED_META.title}</title>
  <subtitle>${FEED_META.subtitle}</subtitle>
  <link href="${FEED_META.feedUrl}" rel="self" />
  <link href="${FEED_META.siteUrl}" />
  <updated>${generatedAt}</updated>
  <generator>ram-index-feed/2.0 (github-actions)</generator>
  <author><name>${FEED_META.author}</name></author>
  <rights>CC BY 4.0 — The ARC Institute of Knowware</rights>
${entries}
</feed>`;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const generatedAt = new Date().toISOString();
  console.log(`feed-update: starting at ${generatedAt} (since ${SINCE_HOURS}h)`);

  // 1. Load existing feed
  let existing = [];
  if (existsSync(FEED)) {
    try {
      existing = parseFeed(readFileSync(FEED, 'utf8'));
      console.log(`  existing: ${existing.length} items`);
    } catch (e) {
      console.warn(`  could not parse existing feed: ${e.message}`);
    }
  }

  // 2. Gather new items from sources
  const sources = [];
  if (process.env.GOOGLE_NEWS_ENABLED !== '0') sources.push(['google-news', fetchGoogleNews()]);
  sources.push(['opml', fetchOpml()]);
  sources.push(['raindrop', fetchRaindrop()]);

  const fresh = [];
  for (const [name, promise] of sources) {
    try {
      const items = await promise;
      console.log(`  ${name}: ${items.length} candidate items`);
      fresh.push(...items);
    } catch (e) {
      console.warn(`  ${name}: ${e.message}`);
    }
  }

  // 3. Dedup new items against each other and against the existing feed
  const seen = new Set(existing.map(dedupKey));
  const cleanFresh = fresh
    .filter((item) => {
      const key = dedupKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item) => {
      const scored = scoreItem(item);
      return {
        ...scored,
        url: cleanUrl(item.url),
        title: sanitizeTitle(item.title),
        excerpt: sanitizeExcerpt(item.excerpt),
      };
    })
    .filter((item) => item.title && item.url && !isCorrupted(item.title))
    .filter((item) => isRelevant(item));

  const droppedOffTopic = fresh.length - cleanFresh.length;
  console.log(`  new after dedup+sanitize: ${cleanFresh.length} (${droppedOffTopic} off-topic/relevant-gate drops)`);

  // 4. Merge, re-dedup the merged list, sort, cap
  const merged = [...cleanFresh, ...existing];
  const byKey = new Map();
  for (const item of merged) {
    const key = dedupKey(item);
    if (!byKey.has(key) || new Date(item.publishedAt) > new Date(byKey.get(key).publishedAt)) {
      byKey.set(key, item);
    }
  }
  const items = [...byKey.values()]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, FEED_META.maxItems);

  const xml = renderAtom(items, generatedAt);

  if (DRY_RUN) {
    console.log(`  [dry-run] would write ${items.length} items to ${FEED}`);
    console.log(`  [dry-run] newest: ${items[0]?.title?.slice(0, 80) ?? 'none'}`);
    return;
  }

  writeFileSync(FEED, xml, 'utf8');
  console.log(`  wrote ${FEED}: ${items.length} items, feed updated ${generatedAt}`);
  console.log(`  picks: ${items.filter(i => i.editorialPick).length} · tags: ${JSON.stringify(
    items.reduce((a, i) => ({ ...a, [i.tag]: (a[i.tag] ?? 0) + 1 }), {}))}`);
}

import { pathToFileURL } from 'url';
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((e) => { console.error('feed-update failed:', e); process.exit(1); });
}
