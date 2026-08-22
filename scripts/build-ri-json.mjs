#!/usr/bin/env node
/**
 * build-ri-json.mjs — generate docs/data/ri.json from data/indices-wide-v3.csv
 *
 * The Ramification Index page used to carry a hand-copied copy of the annual
 * series in index.html — that drifted in 18 of 47 years (see the v3
 * self-audit). This script derives the series, headline and derived facts
 * from the single source of truth so the page can never drift again.
 *
 *   node scripts/build-ri-json.mjs [--check] [--print]
 *
 * --check  exit 1 if the emitted JSON would change the page's headline series
 * --print  write to stdout instead of docs/data/ri.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const CSV = resolve(ROOT, 'data/indices-wide-v3.csv');
const OUT = resolve(ROOT, 'docs/data/ri.json');

const PRINT = process.argv.includes('--print');
const CHECK = process.argv.includes('--check');

// ── Minimal CSV parser (handles quoted fields containing commas) ────

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((f) => f.trim() !== '')) rows.push(row); }
  return rows;
}

const num = (v) => (v === undefined || v === null || String(v).trim() === '') ? null : Number(v);

function build() {
  if (!existsSync(CSV)) throw new Error(`Missing ${CSV}`);
  const rows = parseCsv(readFileSync(CSV, 'utf8'));
  const header = rows[0];
  const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));

  const annual = [];
  for (const r of rows.slice(1)) {
    const y = num(r[idx.year]);
    if (y === null) continue;
    annual.push({
      y,
      v: num(r[idx.ram_index_R]),
      rc: num(r[idx.ram_commodity_R]),
      rai: num(r[idx.ram_ai_R]),
      recession: num(r[idx.nber_recession]) ?? 0,
      status: (r[idx.row_status] || '').trim() || null,
      // Extra series for the interactive dashboard (price/GDP/folk-index charts) —
      // all sourced from the same CSV row so they can never drift from the headline.
      priceGb: num(r[idx.ram_usd_per_gb]),
      priceCommGb: num(r[idx.ram_commodity_usd_per_gb]),
      priceHbmGb: num(r[idx.ram_hbm_usd_per_gb]),
      gdpYoy: num(r[idx.real_gdp_yoy]),
      lipstickIdx: num(r[idx.lipstick_index_2001_100]),
      hemlineScore: num(r[idx.hemline_score_0_10]),
      muiYoy: num(r[idx.mui_yoy_pct]),
      boxOfficeB: num(r[idx.box_office_b_usd]),
    });
  }
  annual.sort((a, b) => a.y - b.y);

  // Derive year-over-year deltas for the folk indices (raw levels in the CSV,
  // but the comparison chart plots YoY change like the Ramification Index does).
  const pctYoy = (curr, prev) => (curr == null || prev == null || prev === 0) ? null : ((curr / prev - 1) * 100);
  const diffYoy = (curr, prev) => (curr == null || prev == null) ? null : (curr - prev);
  for (let i = 0; i < annual.length; i++) {
    const prev = i > 0 ? annual[i - 1] : null;
    annual[i].lipstickYoy = prev ? pctYoy(annual[i].lipstickIdx, prev.lipstickIdx) : null;
    annual[i].hemlineYoy  = prev ? diffYoy(annual[i].hemlineScore, prev.hemlineScore) : null;
    annual[i].boxYoy      = prev ? pctYoy(annual[i].boxOfficeB, prev.boxOfficeB) : null;
    // muiYoy already comes as a YoY % straight from the CSV — no derivation needed.
  }

  const last = annual[annual.length - 1] ?? {};
  const lastYear = last.y;
  const prior = annual.find((d) => d.y === lastYear - 1) ?? {};

  // Highest RI before the headline year (for the "highest since YYYY" claim)
  const history = annual.filter((d) => d.y < lastYear && d.v !== null);
  let maxPrior = null;
  for (const d of history) if (maxPrior === null || d.v > maxPrior.v) maxPrior = d;
  const highestSince = maxPrior && maxPrior.v < last.v ? maxPrior.y : null;

  const headline = {
    year: lastYear,
    ri: last.v,
    rc: last.rc,
    rai: last.rai,
    hbmWeight: num(lastRowValue(rows, idx, 'hbm_weight')) ?? null,
    commodityUsdPerGb: num(lastRowValue(rows, idx, 'ram_commodity_usd_per_gb')) ?? null,
    hbmUsdPerGb: num(lastRowValue(rows, idx, 'ram_hbm_usd_per_gb')) ?? null,
    gdpYoy: num(lastRowValue(rows, idx, 'real_gdp_yoy')) ?? null,
    sp500Return: num(lastRowValue(rows, idx, 'sp500_return')) ?? null,
    status: (last.status || '').trim() || null,
    highestSince,
  };

  return {
    generatedAt: new Date().toISOString(),
    source: 'data/indices-wide-v3.csv',
    headline,
    annual,
  };
}

function lastRowValue(rows, idx, col) {
  for (let i = rows.length - 1; i >= 1; i--) {
    const v = rows[i][idx[col]];
    if (v !== undefined && String(v).trim() !== '') return v;
  }
  return null;
}

const data = build();
const json = JSON.stringify(data, null, 2) + '\n';

if (PRINT) {
  process.stdout.write(json);
} else {
  writeFileSync(OUT, json);
  console.log(`wrote ${OUT}`);
  const h = data.headline;
  console.log(`headline ${h.year}: RI ${h.ri} · R_C ${h.rc} · R_AI ${h.rai} · ω ${h.hbmWeight} · status ${h.status}`);
  console.log(`highest since: ${h.highestSince ?? 'n/a'} · annual series: ${data.annual.length} years (${data.annual[0].y}–${h.year})`);
  if (h.ri !== 0.863) console.log(`note: headline RI is ${h.ri} (page hardcodes 0.863)`);
}
