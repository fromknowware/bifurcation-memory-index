#!/usr/bin/env node
/**
 * build-briefing.mjs — The RAM Index Daily Briefing
 *
 * Reads docs/feed.xml + docs/data/settings.json and writes:
 *   docs/briefing/<YYYY-MM-DD>.html  — dated archive copy
 *   docs/briefing/index.html         — latest briefing + list of earlier ones
 *
 * Content: the top N notes by signal score over the last 48h, the
 * "Day N of RAMageddon" counter, an editorial intro (auto line, or a manual
 * editor's note from docs/briefing/editorials/<date>.md if present), and a
 * subscribe CTA. Links point at the generated story pages.
 *
 * Usage: node scripts/build-briefing.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseFeed, esc } from './feed-update.mjs';
import { storyUrl } from './lib/slug.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const FEED = resolve(ROOT, 'docs/feed.xml');
const SETTINGS = resolve(ROOT, 'docs/data/settings.json');
const BRIEFING_DIR = resolve(ROOT, 'docs/briefing');
const EDITORIAL_DIR = resolve(BRIEFING_DIR, 'editorials');

const TAG_LABEL = { supply: 'SUPPLY', demand: 'DEMAND', fab: 'FAB', earnings: 'EARNINGS', macro: 'MACRO' };
const TAG_CLASS = { supply: 'supply', demand: 'demand', fab: 'fab', earnings: 'earnings', macro: 'macro' };

const CSS = `
:root{--bg:#111416;--bg1:#171a1e;--bg2:#1c2024;--line:#262b32;--line2:#32383f;--muted:#596170;--dim:#434b58;--text:#a0acbc;--bright:#c0cad8;--ram:#e8a428;--hbm:#00b896;--comm:#c8a040;--green:#38b868;}
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
.meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;color:var(--muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:12px;}
.days{border:1px solid rgba(232,164,40,0.4);border-left:4px solid var(--ram);background:rgba(232,164,40,0.06);padding:14px 18px;border-radius:4px;margin:0 0 20px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:13px;color:var(--ram);}
.days b{font-size:18px;}
h1{font-size:24px;color:var(--bright);margin:4px 0 6px;}
.dateline{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;color:var(--muted);margin-bottom:18px;}
.editorial{font-size:14px;color:var(--text);margin:0 0 22px;padding:14px 16px;background:var(--bg1);border:1px solid var(--line);border-radius:4px;}
.note{border-bottom:1px solid var(--line);padding:16px 0;}
.note-top{display:flex;align-items:center;gap:10px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;color:var(--muted);letter-spacing:0.05em;text-transform:uppercase;margin-bottom:8px;}
.tag{display:inline-block;padding:2px 8px;border:1px solid var(--line2);border-radius:3px;}
.tag.supply{color:var(--comm);border-color:rgba(200,160,64,0.35);}
.tag.demand{color:var(--hbm);border-color:rgba(0,184,150,0.35);}
.tag.fab{color:#b8985a;border-color:rgba(184,152,90,0.35);}
.tag.earnings{color:#5ab870;border-color:rgba(90,184,112,0.35);}
.tag.macro{color:#8a5ab8;border-color:rgba(138,90,184,0.35);}
.tag.pick{color:var(--ram);border-color:rgba(232,164,40,0.3);}
.note h2{font-size:16px;color:var(--bright);margin:2px 0 8px;line-height:1.4;}
.note h2 a:hover{color:var(--ram);}
.verdict{font-size:13px;color:var(--text);margin:6px 0;}
.verdict em{color:var(--ram);font-style:normal;}
.score{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;color:var(--dim);margin-top:6px;}
.sub{display:flex;gap:10px;align-items:center;margin:26px 0;padding:14px 16px;border:1px solid var(--line2);border-radius:4px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;color:var(--muted);flex-wrap:wrap;}
.sub a{color:var(--ram);border:1px solid rgba(232,164,40,0.35);padding:6px 12px;border-radius:3px;}
.sub a:hover{background:rgba(232,164,40,0.08);}
.prev{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;color:var(--muted);margin-top:26px;border-top:1px solid var(--line);padding-top:14px;}
.prev a{color:var(--text);}
.prev a:hover{color:var(--ram);}
` + '\n';

function pageShell(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)} — The RAM Index</title>
<meta name="description" content="The RAM Index Daily Briefing — the memory market read through the Ramification Index lens.">
<meta property="og:type" content="website">
<meta property="og:site_name" content="The RAM Index — The ARC Institute of Knowware">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="The RAM Index Daily Briefing — the memory market read through the Ramification Index lens.">
<meta property="og:url" content="https://ram-index.com/briefing/index.html">
<meta property="og:image" content="https://ram-index.com/og-preview.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<header class="hd">
  <a class="hd-brand" href="/">RAM <em>INDEX</em></a>
  <nav class="hd-nav"><a href="/">Live Index</a><a href="/stories/index.html">Stories</a><a href="/feed.xml">RSS</a></nav>
</header>
<div class="wrap">
${body}
</div>
</body>
</html>`;
}

function main() {
  const settings = JSON.parse(readFileSync(SETTINGS, 'utf8'));
  const items = parseFeed(readFileSync(FEED, 'utf8'));
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // Day N of RAMageddon
  const start = new Date(settings.ramageddonStart + 'T00:00:00Z');
  const dayN = Math.max(1, Math.floor((now - start) / 86400000) + 1);
  const daysLabel = settings.ramageddonLabel.replace('{n}', dayN);

  // Top notes: signal desc, then date desc; prefer items with verdicts
  const scored = items
    .map((it) => ({ it, score: it.signal ?? (it.editorialPick ? 10 : 6) }))
    .sort((a, b) => b.score - a.score || new Date(b.it.publishedAt) - new Date(a.it.publishedAt));
  const top = scored.slice(0, 7);

  // Editorial intro: manual note if present, else auto line
  let editorial = '';
  const manual = resolve(EDITORIAL_DIR, `${today}.md`);
  if (existsSync(manual)) {
    editorial = readFileSync(manual, 'utf8').trim()
      .replace(/\n/g, '<br>')
      .replace(/^#+ .*$/gm, '');
  } else {
    editorial = `The RAM Index read ${items.length} stories from the last 24h of memory-market news against the thesis — commodity DRAM supply reallocation toward HBM, and what it means for R_C, R_AI, and the composite signal. ${top.length} made the cut. The full archive is on the <a href="/stories/index.html" style="color:var(--hbm);">Stories</a> page.`;
  }

  const notes = top.map(({ it, score }) => {
    const tag = it.tag || 'supply';
    const pick = it.editorialPick ? '<span class="tag pick">★ PICK</span>' : '';
    const date = (it.publishedAt || '').slice(0, 10);
    const verdict = it.riImplication || (it.editorialPick ? 'Editorial pick — selected by The RAM Index as material to the memory cycle.' : '');
    return `<div class="note">
      <div class="note-top"><span class="tag ${TAG_CLASS[tag]}">${TAG_LABEL[tag]}</span>${pick}<span>${date}</span><span>${esc(it.source || '')}</span></div>
      <h2><a href="${storyUrl(it)}">${esc(it.title || 'Untitled')}</a></h2>
      <div class="verdict"><em>RI note:</em> ${esc(verdict || 'No verdict yet.')}</div>
      <div class="score">Signal ${score}/10 · <a href="${storyUrl(it)}" style="color:var(--dim);">read the note →</a></div>
    </div>`;
  }).join('\n');

  // Earlier briefings (dated archives)
  let previous = [];
  if (existsSync(BRIEFING_DIR)) {
    previous = readdirSync(BRIEFING_DIR)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.html$/.test(f))
      .sort()
      .reverse()
      .slice(0, 14);
  }
  const prevHtml = previous.length
    ? `<div class="prev">Earlier briefings: ${previous.map((f) =>
        `<a href="/briefing/${f}">${f.replace('.html', '')}</a>`).join(' · ')}</div>`
    : '';

  const body = `
  <div class="meta"><span class="tag supply">BRIEFING</span><span>Daily · ${today}</span></div>
  <h1>The RAM Index Briefing</h1>
  <div class="dateline">${today} · auto-generated every 6h from the live feed</div>
  <div class="days">${esc(daysLabel)}</div>
  <div class="editorial">${editorial}</div>
  <div class="notes">${notes}</div>
  <div class="sub">
    <span>Get this daily in your inbox:</span>
    <a href="/feed.xml" target="_blank" rel="noopener">Subscribe via RSS</a>
    <a href="/stories/index.html">All stories</a>
  </div>
  ${prevHtml}
`;

  mkdirSync(BRIEFING_DIR, { recursive: true });
  writeFileSync(resolve(BRIEFING_DIR, `${today}.html`), pageShell(`Daily Briefing — ${today}`, body));
  writeFileSync(resolve(BRIEFING_DIR, 'index.html'), pageShell(`Daily Briefing — ${today}`, body));
  console.log(`briefing: ${today} · Day ${dayN} of RAMageddon · ${top.length} notes · ${previous.length} archives`);
}

main();
