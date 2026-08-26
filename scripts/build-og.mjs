#!/usr/bin/env node
/**
 * build-og.mjs — per-story social cards (1200×630 PNG) for The RAM Index
 *
 * Reads docs/feed.xml and writes docs/stories/cards/<slug>.png for stories
 * that don't have a card yet (skip-existing keeps every-6h runs cheap).
 * Cards are rendered as SVG → PNG via `sharp` (npm i sharp in the workflow).
 *
 * If sharp is not installed the script exits 0 with a warning — story pages
 * still work, they just share the static og-preview.png in that case.
 *
 * Usage: node scripts/build-og.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseFeed, esc } from './feed-update.mjs';
import { storySlug } from './lib/slug.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const FEED = resolve(ROOT, 'docs/feed.xml');
const CARDS_DIR = resolve(ROOT, 'docs/stories/cards');

const TAG_LABEL = { supply: 'SUPPLY', demand: 'DEMAND', fab: 'FAB', earnings: 'EARNINGS', macro: 'MACRO' };
const TAG_COLOR = { supply: '#c8a040', demand: '#00b896', fab: '#b8985a', earnings: '#5ab870', macro: '#8a5ab8' };
const W = 1200, H = 630;

/** Approximate word-wrap for SVG text (DejaVu-ish widths). */
function wrap(text, maxChars) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars) {
      if (line) lines.push(line.trim());
      line = w;
    } else {
      line += (line ? ' ' : '') + w;
    }
  }
  if (line) lines.push(line.trim());
  return lines.slice(0, 4);
}

function cardSvg(item, tag, score) {
  const titleLines = wrap(item.title || 'Untitled', 42);
  const verdict = item.riImplication || (item.editorialPick
    ? 'Editorial pick — selected by The RAM Index as material to the memory cycle.'
    : 'No verdict yet — pending annotation.');
  const verdictLines = wrap(verdict, 78).slice(0, 3);
  const tagColor = TAG_COLOR[tag] || '#c8a040';
  const date = (item.publishedAt || '').slice(0, 10);

  const titleY = 250;
  const titleTspans = titleLines.map((l, i) =>
    `<tspan x="70" dy="${i === 0 ? 0 : 62}">${esc(l)}</tspan>`).join('');
  const verdictY = titleY + titleLines.length * 62 + 40;
  const verdictTspans = verdictLines.map((l, i) =>
    `<tspan x="70" dy="${i === 0 ? 0 : 34}">${esc(l)}</tspan>`).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#111416"/>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="#262b32" stroke-width="2"/>
  <line x1="0" y1="120" x2="${W}" y2="120" stroke="#1c2024" stroke-width="2"/>
  <text x="70" y="78" font-family="DejaVu Sans Mono, Menlo, monospace" font-size="26" font-weight="700" letter-spacing="6" fill="#c0cad8">RAM <tspan fill="#e8a428">INDEX</tspan></text>
  <text x="${W - 70}" y="78" text-anchor="end" font-family="DejaVu Sans Mono, Menlo, monospace" font-size="22" font-weight="700" fill="${tagColor}">${TAG_LABEL[tag] || 'SUPPLY'}</text>
  <text x="${W - 70}" y="106" text-anchor="end" font-family="DejaVu Sans Mono, Menlo, monospace" font-size="18" fill="#596170">SIGNAL ${score}/10</text>
  <text x="70" y="${titleY}" font-family="DejaVu Sans, Arial, sans-serif" font-size="48" font-weight="700" fill="#c0cad8">${titleTspans}</text>
  <text x="70" y="${verdictY}" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" fill="#7888a0">${verdictTspans}</text>
  <text x="70" y="${H - 56}" font-family="DejaVu Sans Mono, Menlo, monospace" font-size="20" fill="#596170">${date} · ${esc((item.source || '').slice(0, 48))}</text>
  <text x="${W - 70}" y="${H - 56}" text-anchor="end" font-family="DejaVu Sans Mono, Menlo, monospace" font-size="20" fill="#596170">ram-index.com/stories</text>
</svg>`;
}

async function main() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.warn('og: sharp not installed — skipping card generation (install with `npm i --prefix scripts sharp`)');
    return;
  }

  const items = parseFeed(readFileSync(FEED, 'utf8'));
  const current = new Set(items.map((it) => storySlug(it)));
  if (existsSync(CARDS_DIR)) {
    for (const f of readdirSync(CARDS_DIR)) {
      if (f.endsWith('.png') && !current.has(f.replace(/\.png$/, ''))) {
        unlinkSync(resolve(CARDS_DIR, f));
      }
    }
  }
  let made = 0, skipped = 0;
  for (const item of items) {
    const slug = storySlug(item);
    const out = resolve(CARDS_DIR, `${slug}.png`);
    if (existsSync(out)) { skipped++; continue; }
    const tag = item.tag || 'supply';
    const score = item.signal ?? (item.editorialPick ? 10 : 6);
    const svg = cardSvg(item, tag, score);
    mkdirSync(CARDS_DIR, { recursive: true });
    await sharp(Buffer.from(svg)).png().toFile(out);
    made++;
  }
  console.log(`og: ${made} cards generated, ${skipped} existing`);
}

main().catch((e) => { console.error('og failed:', e.message); process.exit(1); });
