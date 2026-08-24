/**
 * reimply-local.mjs — backfill RI implications locally using your Anthropic API key
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/reimply-local.mjs [--limit 20] [--dry-run]
 *
 * Reads docs/feed.xml, scores items missing riImplication, writes updated feed.xml.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir  = dirname(fileURLToPath(import.meta.url));
const FEED   = resolve(__dir, '../docs/feed.xml');

const THESIS = 'DRAM ASP as a leading GDP indicator; bifurcation between commodity DRAM and HBM';

const args     = process.argv.slice(2);
const limit    = parseInt(args[args.indexOf('--limit') + 1] || '20', 10);
const dryRun   = args.includes('--dry-run');
const apiKey   = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.error('Set ANTHROPIC_API_KEY env var before running.');
  process.exit(1);
}

// ── XML helpers ────────────────────────────────────────────────────────────────

function unesc(s) {
  return s
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'");
}

function esc(s) {
  return String(s)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

function parseItems(xml) {
  const items = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/gi;
  let m;
  while ((m = entryRe.exec(xml)) !== null) {
    const block   = m[1];
    const raw     = m[0];
    const url     = (block.match(/<link href="([^"]+)"/) ?? [])[1] ?? '';
    const title   = unesc((block.match(/<title[^>]*>([\s\S]*?)<\/title>/) ?? [])[1] ?? '');
    const summary = unesc((block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/) ?? [])[1] ?? '');
    const source  = unesc((block.match(/<name>([\s\S]*?)<\/name>/) ?? [])[1] ?? '');
    const updated = (block.match(/<updated>([\s\S]*?)<\/updated>/) ?? [])[1] ?? '';
    const cats    = [...block.matchAll(/<category term="([^"]+)"/g)].map(c => c[1]);

    // Extract existing riImplication from summary
    const riSplit = summary.indexOf(' RI implication: ');
    const excerpt      = riSplit >= 0 ? summary.slice(0, riSplit) : summary;
    const riImplication = riSplit >= 0 ? summary.slice(riSplit + 17) : '';

    items.push({ url, title, excerpt, source, updated, cats, riImplication, raw });
  }
  return items;
}

// ── Anthropic scorer ───────────────────────────────────────────────────────────

const SYSTEM = `You are the editorial filter for The RAM Index — a macroeconomic research publication that tracks DRAM average selling prices (ASP) as a leading indicator of global GDP.

Current thesis: "${THESIS}"

For each article, produce one short sentence (starting with a verb) describing what it means for R_C (commodity DRAM), R_AI (HBM/AI memory), the composite Ramification Index, or the bifurcation thesis.

Respond with JSON only. No markdown.`;

async function annotate(batch) {
  const prompt = `Return a JSON array with one object per article, same order:
[{"ri_implication": "<one sentence starting with a verb>"}, ...]

Articles:
${batch.map((it, i) => `${i + 1}. "${it.title}" — ${it.excerpt.slice(0, 150)}`).join('\n')}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body}`);
  }

  const data = await res.json();
  let text = data.content[0]?.text ?? '[]';
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(text);
}

// ── Main ───────────────────────────────────────────────────────────────────────

const xml   = readFileSync(FEED, 'utf8');
const items = parseItems(xml);

const missing = items.filter(it => !it.riImplication).slice(0, limit);
console.log(`Feed: ${items.length} items — ${missing.length} need RI implication (limit ${limit})`);

if (missing.length === 0) {
  console.log('Nothing to do.');
  process.exit(0);
}

// Batch in groups of 10
const implMap = new Map();
for (let i = 0; i < missing.length; i += 10) {
  const batch = missing.slice(i, i + 10);
  console.log(`Scoring batch ${Math.floor(i/10)+1} (${batch.length} items)…`);
  try {
    const scores = await annotate(batch);
    for (let j = 0; j < batch.length; j++) {
      const ri = scores[j]?.ri_implication;
      if (ri) implMap.set(batch[j].url, ri);
    }
  } catch (err) {
    console.error('Batch failed:', String(err));
  }
}

console.log(`Got implications for ${implMap.size} items.`);
if (implMap.size === 0) process.exit(1);

// Patch feed.xml — update <summary> for each item that got an implication
let updated = xml;
for (const item of missing) {
  const ri = implMap.get(item.url);
  if (!ri) continue;

  const newSummary = esc(item.excerpt + ' RI implication: ' + ri);
  updated = updated.replace(
    item.raw,
    item.raw.replace(
      /<summary[^>]*>[\s\S]*?<\/summary>/,
      `<summary type="html">${newSummary}</summary>`,
    ),
  );
}

if (dryRun) {
  console.log('Dry run — not writing. Implications:');
  implMap.forEach((ri, url) => console.log(`  ${url.slice(0, 60)}…\n  → ${ri}\n`));
} else {
  writeFileSync(FEED, updated, 'utf8');
  console.log(`Wrote ${FEED}`);
  console.log(`Run: git add docs/feed.xml && git commit -m "feat: backfill RI implications (${implMap.size} items)" && git push`);
}
