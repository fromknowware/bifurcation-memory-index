#!/usr/bin/env node
/**
 * build-review.mjs — The RAM Index Weekly Review
 *
 * Reads docs/feed.xml and writes:
 *   docs/review/<YYYY>-W<ww>.html   — this week's review (auto stats + verdicts)
 *   docs/review/index.html          — list of all reviews
 *
 * An optional editor's take can be dropped at
 * docs/review/editorials/<YYYY>-W<ww>.md — it is included verbatim (markdown
 * line breaks converted). Without it, a neutral auto line is used.
 *
 * Usage: node scripts/build-review.mjs   (run weekly via update-review.yml)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseFeed, esc } from './feed-update.mjs';
import { storyUrl } from './lib/slug.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const FEED = resolve(ROOT, 'docs/feed.xml');
const REVIEW_DIR = resolve(ROOT, 'docs/review');
const EDITORIAL_DIR = resolve(REVIEW_DIR, 'editorials');

const TAG_LABEL = { supply: 'SUPPLY', demand: 'DEMAND', fab: 'FAB', earnings: 'EARNINGS', macro: 'MACRO' };
const TAG_COLOR = { supply: '#c8a040', demand: '#00b896', fab: '#b8985a', earnings: '#5ab870', macro: '#8a5ab8' };

const CSS = `
:root{--bg:#111416;--bg1:#171a1e;--bg2:#1c2024;--line:#262b32;--line2:#32383f;--muted:#596170;--dim:#434b58;--text:#a0acbc;--bright:#c0cad8;--ram:#e8a428;--hbm:#00b896;}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6;}
a{color:inherit;text-decoration:none;}
.mono{font-family:'IBM Plex Mono',ui-monospace,monospace;}
.hd{display:flex;align-items:center;gap:14px;border-bottom:1px solid var(--line);background:var(--bg1);padding:10px 24px;font-size:12px;}
.hd-brand{font-family:'IBM Plex Mono',ui-monospace,monospace;font-weight:700;color:var(--bright);letter-spacing:0.05em;}
.hd-brand em{color:var(--ram);font-style:normal;}
.hd-nav{margin-left:auto;display:flex;gap:16px;color:var(--muted);}
.hd-nav a:hover{color:var(--ram);}
.wrap{max-width:760px;margin:0 auto;padding:28px 24px 60px;}
.meta{display:flex;align-items:center;gap:10px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;color:var(--muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:12px;}
h1{font-size:24px;color:var(--bright);margin:4px 0 6px;}
.dateline{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;color:var(--muted);margin-bottom:18px;}
.editorial{font-size:14px;padding:14px 16px;background:var(--bg1);border:1px solid var(--line);border-radius:4px;margin-bottom:22px;}
.sec-h{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;font-weight:700;letter-spacing:0.12em;color:var(--muted);text-transform:uppercase;margin:26px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px;}
.kpis{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:6px;}
.kpi{flex:1;min-width:130px;border:1px solid var(--line);border-radius:4px;padding:12px 14px;background:var(--bg1);}
.kpi b{display:block;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:22px;color:var(--ram);}
.kpi span{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:9px;color:var(--muted);letter-spacing:0.08em;text-transform:uppercase;}
.bar-row{display:flex;align-items:center;gap:10px;margin:6px 0;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;}
.bar-lbl{width:80px;color:var(--muted);}
.bar-track{flex:1;height:10px;background:var(--bg1);border:1px solid var(--line);border-radius:3px;overflow:hidden;}
.bar-fill{height:100%;}
.bar-n{width:44px;text-align:right;color:var(--dim);}
.story{display:flex;align-items:baseline;gap:10px;padding:8px 0;border-bottom:1px solid var(--line);font-size:13px;}
.story a:hover{color:var(--ram);}
.story .d{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:9px;color:var(--dim);white-space:nowrap;}
.story .s{margin-left:auto;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;color:var(--muted);}
.prev{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;color:var(--muted);margin-top:26px;border-top:1px solid var(--line);padding-top:14px;}
.prev a{color:var(--text);}
.prev a:hover{color:var(--ram);}
` + '\n';

/** ISO week (year, week) for a Date. */
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function shell(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)} — The RAM Index</title>
<meta name="description" content="The RAM Index Weekly Review — what the signal saw this week.">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="The RAM Index Weekly Review — what the signal saw this week.">
<meta property="og:image" content="https://ram-index.com/og-preview.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<header class="hd">
  <a class="hd-brand" href="/">RAM <em>INDEX</em></a>
  <nav class="hd-nav"><a href="/">Live Index</a><a href="/stories/index.html">Stories</a><a href="/briefing/index.html">Briefing</a><a href="/feed.xml">RSS</a></nav>
</header>
<div class="wrap">
${body}
</div>
</body>
</html>`;
}

function main() {
  const items = parseFeed(readFileSync(FEED, 'utf8'));
  const week = isoWeek(new Date());
  const [y, w] = week.split('-W');
  const inWeek = items.filter((it) => isoWeek(new Date(it.publishedAt)) === week);
  // Archive lists weeks that actually have a review page on disk
  const allWeeks = existsSync(REVIEW_DIR)
    ? readdirSync(REVIEW_DIR).filter((f) => /^\d{4}-W\d{2}\.html$/.test(f)).map((f) => f.replace(/\.html$/, '')).sort().reverse()
    : [];

  // Editor's take
  let editorial = '';
  const manual = resolve(EDITORIAL_DIR, `${week}.md`);
  if (existsSync(manual)) {
    editorial = readFileSync(manual, 'utf8').trim()
      .replace(/\n/g, '<br>')
      .replace(/^#+ .*$/gm, '');
  } else {
    editorial = `Auto-generated review of week ${w}, ${y}. Drop a note in <span class="mono" style="font-size:11px;">docs/review/editorials/${week}.md</span> to replace this line with your own take.`;
  }

  // Stats
  const picks = inWeek.filter((it) => it.editorialPick).length;
  const sources = new Set(inWeek.map((it) => it.source)).size;
  const tagCounts = {};
  for (const it of inWeek) tagCounts[it.tag || 'supply'] = (tagCounts[it.tag || 'supply'] || 0) + 1;
  const maxTag = Math.max(1, ...Object.values(tagCounts));
  const barRows = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).map(([t, n]) =>
    `<div class="bar-row"><span class="bar-lbl">${TAG_LABEL[t] || t}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round((n / maxTag) * 100)}%;background:${TAG_COLOR[t] || '#c8a040'};"></div></div><span class="bar-n">${n}</span></div>`).join('');

  // Top stories by signal
  const top = [...inWeek]
    .sort((a, b) => (b.signal ?? 6) - (a.signal ?? 6) || new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, 8);
  const topHtml = top.map((it) =>
    `<div class="story"><span class="d">${(it.publishedAt || '').slice(0, 10)}</span><a href="${storyUrl(it)}">${esc(it.title || 'Untitled')}</a><span class="s">${it.signal ?? 6}/10${it.editorialPick ? ' ★' : ''}</span></div>`).join('');

  const kpis = `
    <div class="kpi"><b>${inWeek.length}</b><span>notes this week</span></div>
    <div class="kpi"><b>${picks}</b><span>editorial picks</span></div>
    <div class="kpi"><b>${sources}</b><span>sources</span></div>
    <div class="kpi"><b>${Math.max(...(top.length ? top.map(t => t.signal ?? 6) : [0]))}/10</b><span>top signal</span></div>`;

  const body = `
  <div class="meta"><span class="tag mono" style="color:var(--ram);border:1px solid rgba(232,164,40,0.35);">WEEKLY REVIEW</span><span>${week}</span></div>
  <h1>The RAM Index — Week in Review</h1>
  <div class="dateline">${week} · auto-composed from the live feed</div>
  <div class="editorial">${editorial}</div>
  <div class="sec-h">The week by the numbers</div>
  ${kpis}
  <div class="sec-h">Signal mix</div>
  ${barRows}
  <div class="sec-h">Top notes by signal</div>
  ${topHtml || '<div class="story">No notes this week yet.</div>'}
  <div class="sec-h">Archive</div>
  <div class="prev">${allWeeks.map((wk) =>
    `<a href="/review/${wk}.html">${wk}</a>`).join(' · ')}</div>
`;

  mkdirSync(REVIEW_DIR, { recursive: true });
  writeFileSync(resolve(REVIEW_DIR, `${week}.html`), shell(`Week in Review — ${week}`, body));
  writeFileSync(resolve(REVIEW_DIR, 'index.html'), shell(`Week in Review — ${week}`, body));
  console.log(`review: ${week} · ${inWeek.length} notes · ${picks} picks · ${sources} sources`);
}

main();
