#!/usr/bin/env node
/**
 * backfill-pick-dates.mjs — one-time correction for editorial picks
 *
 * Every existing editorial pick in docs/feed.xml has publishedAt set to the
 * Raindrop bookmark's *save* time (see feed-update.mjs), not the underlying
 * article's real publish date — Raindrop's API doesn't expose that field at
 * all. feed-update.mjs now scrapes the real date for NEW picks going
 * forward, but deliberately skips re-fetching picks already in the feed (to
 * avoid re-scraping dozens of pages on every 6h run).
 *
 * This script is the one-time catch-up: scrape a real publish date for
 * every existing pick, falling back to the old save-time date if scraping
 * fails, then rewrite docs/feed.xml. Run scripts/build-stories.mjs
 * afterwards to regenerate the per-story archive pages with corrected
 * dates.
 *
 * Usage: node scripts/backfill-pick-dates.mjs [--dry-run] [--concurrency 8]
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseFeed, renderAtom, fetchArticlePublishedDate } from './feed-update.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const FEED = resolve(ROOT, 'docs/feed.xml');

const DRY_RUN = process.argv.includes('--dry-run');
const concFlag = process.argv.indexOf('--concurrency');
const CONCURRENCY = concFlag >= 0 ? parseInt(process.argv[concFlag + 1], 10) || 8 : 8;

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function main() {
  const items = parseFeed(readFileSync(FEED, 'utf8'));
  const picks = items.filter((it) => it.editorialPick);
  console.log(`backfill-pick-dates: ${items.length} total items, ${picks.length} editorial picks`);

  let corrected = 0;
  let unchanged = 0;
  let failed = 0;

  await mapWithConcurrency(picks, CONCURRENCY, async (item) => {
    const before = item.publishedAt;
    const real = await fetchArticlePublishedDate(item.url);
    if (real && real !== before) {
      console.log(`  corrected: ${before.slice(0, 10)} -> ${real.slice(0, 10)}  ${item.title.slice(0, 70)}`);
      item.publishedAt = real;
      corrected++;
    } else if (real) {
      unchanged++;
    } else {
      console.log(`  no date found, kept bookmark-save date (${before.slice(0, 10)}): ${item.title.slice(0, 70)}`);
      failed++;
    }
  });

  console.log(`  corrected: ${corrected} · already-correct/unchanged: ${unchanged} · scrape failed (kept old date): ${failed}`);

  const sorted = [...items].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  const xml = renderAtom(sorted, new Date().toISOString());

  if (DRY_RUN) {
    console.log(`  [dry-run] would write ${sorted.length} items to ${FEED}`);
    return;
  }
  writeFileSync(FEED, xml, 'utf8');
  console.log(`  wrote ${FEED}`);
}

main();
