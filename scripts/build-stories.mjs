#!/usr/bin/env node
/**
 * build-stories.mjs — The RAM Index "middle layer": story pages for every feed item
 *
 * Reads docs/feed.xml and generates:
 *   docs/stories/<slug>.html          — shareable page: RI verdict, signal score,
 *                                       related stories, share buttons, OG tags, JSON-LD
 *   docs/stories/index.html           — filterable archive (all stories, newest first)
 *   docs/data/stories-index.json      — machine-readable index (archive + future use)
 *
 * Feed entries carry their story URL via <link rel="related">, stamped by
 * feed-update.mjs using the same slug helper (scripts/lib/slug.mjs).
 *
 * Usage: node scripts/build-stories.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseFeed, cleanUrl, esc, unesc, stripHtml } from './feed-update.mjs';
import { storyUrl, storySlug } from './lib/slug.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const FEED = resolve(ROOT, 'docs/feed.xml');
const STORIES_DIR = resolve(ROOT, 'docs/stories');
const INDEX_JSON = resolve(ROOT, 'docs/data/stories-index.json');
const DRY_RUN = process.argv.includes('--dry-run');

const SITE = 'https://ram-index.com';

// ── Styling: the terminal look, self-contained per page ─────────────

const CSS = `
:root{--bg:#111416;--bg1:#171a1e;--bg2:#1c2024;--line:#262b32;--line2:#32383f;--muted:#596170;--dim:#434b58;--text:#a0acbc;--bright:#c0cad8;--ram:#e8a428;--hbm:#00b896;--comm:#c8a040;--green:#38b868;--red:#c84848;}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6;}
a{color:inherit;text-decoration:none;}
.mono{font-family:'IBM Plex Mono',ui-monospace,monospace;}
.hd{display:flex;align-items:center;gap:14px;border-bottom:1px solid var(--line);background:var(--bg1);padding:10px 24px;font-size:12px;}
.hd a:hover{color:var(--ram);}
.hd-brand{font-family:'IBM Plex Mono',ui-monospace,monospace;font-weight:700;color:var(--bright);letter-spacing:0.05em;}
.hd-brand em{color:var(--ram);font-style:normal;}
.hd-nav{margin-left:auto;display:flex;gap:16px;color:var(--muted);}
.wrap{max-width:760px;margin:0 auto;padding:28px 24px 60px;}
.meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;color:var(--muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:14px;}
.tag{display:inline-block;padding:2px 8px;border:1px solid var(--line2);border-radius:3px;}
.tag.supply{color:var(--comm);border-color:rgba(200,160,64,0.35);}
.tag.demand{color:var(--hbm);border-color:rgba(0,184,150,0.35);}
.tag.fab{color:#b8985a;border-color:rgba(184,152,90,0.35);}
.tag.earnings{color:#5ab870;border-color:rgba(90,184,112,0.35);}
.tag.macro{color:#8a5ab8;border-color:rgba(138,90,184,0.35);}
.pick{color:var(--ram);border:1px solid rgba(232,164,40,0.3);}
h1{font-size:26px;line-height:1.3;color:var(--bright);font-weight:650;margin:6px 0 14px;letter-spacing:-0.01em;}
.src{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;color:var(--muted);margin-bottom:20px;}
.note{
  position:relative;overflow:hidden;
  border:1px solid rgba(232,164,40,0.32);
  background:linear-gradient(135deg,rgba(232,164,40,0.10),rgba(232,164,40,0.02) 65%);
  padding:18px 20px 18px 22px;margin:18px 0;border-radius:6px;
  box-shadow:0 1px 0 rgba(255,255,255,0.03) inset,0 8px 24px -12px rgba(232,164,40,0.25);
}
.note::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,var(--ram),rgba(232,164,40,0.35));}
.note-h{
  display:flex;align-items:center;gap:6px;
  font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;font-weight:700;
  letter-spacing:0.12em;color:var(--ram);text-transform:uppercase;margin-bottom:10px;
}
.note-h::before{content:'◆';font-size:8px;}
.note p{font-size:15.5px;color:var(--bright);line-height:1.6;}
.score{
  display:inline-flex;align-items:center;gap:8px;
  font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;color:var(--muted);
  margin:14px 0 4px;padding:6px 12px;
  background:rgba(232,164,40,0.08);border:1px solid rgba(232,164,40,0.22);border-radius:99px;
}
.score b{color:var(--ram);font-size:14px;}
.body{font-size:14px;color:var(--text);}
.excerpt{background:var(--bg1);border:1px solid var(--line);border-radius:4px;padding:14px 16px;margin:14px 0;font-size:13px;color:var(--bright);}
.orig{margin:6px 0 22px;font-size:12px;overflow-wrap:anywhere;}
.orig a{color:var(--hbm);}
.orig a:hover{text-decoration:underline;}
.share{display:flex;gap:8px;flex-wrap:wrap;margin:22px 0;}
.share a,.share button{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:8px 14px;border:1px solid var(--line2);background:var(--bg1);color:var(--bright);cursor:pointer;border-radius:3px;}
.share a:hover,.share button:hover{color:var(--ram);border-color:var(--ram);}
.sec-h{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;font-weight:700;letter-spacing:0.12em;color:var(--muted);text-transform:uppercase;margin:26px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px;}
.related{display:flex;flex-direction:column;gap:8px;}
.related a{font-size:13px;color:var(--text);line-height:1.45;}
.related a:hover{color:var(--ram);}
.related .r-date{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:9px;color:var(--dim);margin-right:8px;}
.learn a{color:var(--hbm);font-size:13px;}
.learn a:hover{text-decoration:underline;}
.foot{border-top:1px solid var(--line);margin-top:40px;padding-top:14px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;color:var(--muted);display:flex;gap:16px;flex-wrap:wrap;}
.foot a:hover{color:var(--ram);}
.pn{display:flex;align-items:stretch;gap:8px;margin-bottom:20px;font-family:'IBM Plex Mono',ui-monospace,monospace;}
.pn-btn{flex:1;display:flex;align-items:center;gap:8px;padding:10px 14px;border:1px solid var(--line2);border-radius:4px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--bright);transition:all 0.1s;}
.pn-btn.next{justify-content:flex-end;text-align:right;}
.pn-btn:hover{color:var(--ram);border-color:var(--ram);background:rgba(232,164,40,0.05);}
.pn-btn.disabled{color:var(--dim);border-color:var(--line);cursor:default;pointer-events:none;}
.pn-arrow{font-size:13px;flex-shrink:0;}
.pn-count{flex-shrink:0;align-self:center;font-size:10px;color:var(--dim);letter-spacing:0.06em;white-space:nowrap;padding:0 2px;}
` + '\n';

// ── Data ─────────────────────────────────────────────────────────────

const LEARN_BY_TAG = {
  supply:   { idx: 0, title: 'Primer: What is DRAM, and why does its price move?' },
  demand:   { idx: 2, title: 'The HBM supercycle and AI\u2019s insatiable RAM appetite' },
  fab:      { idx: 5, title: 'The semiconductor supply chain: who makes what' },
  earnings: { idx: 1, title: 'Why RAM prices predict recessions' },
  macro:    { idx: 1, title: 'Why RAM prices predict recessions' },
};

const TAG_LABEL = { supply: 'SUPPLY', demand: 'DEMAND', fab: 'FAB', earnings: 'EARNINGS', macro: 'MACRO' };
const TAG_CLASS = { supply: 'supply', demand: 'demand', fab: 'fab', earnings: 'earnings', macro: 'macro' };

// ── Page fragments ───────────────────────────────────────────────────

function pageHead(title, description, slug, item, canonical) {
  const og = `https://ram-index.com/stories/cards/${slug}.png`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)} — The RAM Index</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="The RAM Index — Knowware Institute">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${og}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${og}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'NewsArticle',
  headline: title,
  description: description,
  datePublished: item.publishedAt,
  author: { '@type': 'Organization', name: 'The RAM Index', url: SITE },
  publisher: { '@type': 'Organization', name: 'Knowware Institute', url: SITE },
  mainEntityOfPage: canonical,
})}
</script>
<style>${CSS}</style>
</head>
<body>
<header class="hd">
  <a class="hd-brand" href="/">RAM <em>INDEX</em></a>
  <nav class="hd-nav">
    <a href="/">Live Index</a>
    <a href="/stories/index.html">Stories</a>
    <a href="/briefing/index.html">Briefing</a>
    <a href="/feed.xml">RSS</a>
  </nav>
</header>
<div class="wrap">`;
}

function pageFoot() {
  return `</div>
<footer class="wrap" style="padding-top:0;">
  <div class="foot">
    <span>CC BY 4.0 · Knowware Institute</span>
    <a href="/feed.xml">RSS feed</a>
    <a href="/#learn">Learn</a>
    <a href="/paper.html">Research</a>
  </div>
</footer>
<script>
// Rapid-fire keyboard nav: ← / → jump to the prev/next story. Ignored while
// typing in a field, and either bar (top or bottom) works — they carry the
// same links.
document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
  const sel = e.key === 'ArrowLeft' ? '.pn-btn.prev' : e.key === 'ArrowRight' ? '.pn-btn.next' : null;
  if (!sel) return;
  const link = document.querySelector(sel + '[href]');
  if (link) location.href = link.getAttribute('href');
});
</script>
</body>
</html>`;
}

function prevNextBar(prevItem, nextItem, position, index, total) {
  const prev = prevItem
    ? `<a class="pn-btn prev" href="/stories/${storySlug(prevItem)}.html"><span class="pn-arrow">←</span><span>${esc(prevItem.title.slice(0, 40))}${prevItem.title.length > 40 ? '…' : ''}</span></a>`
    : `<span class="pn-btn prev disabled"><span class="pn-arrow">←</span><span>Start of feed</span></span>`;
  const next = nextItem
    ? `<a class="pn-btn next" href="/stories/${storySlug(nextItem)}.html"><span>${esc(nextItem.title.slice(0, 40))}${nextItem.title.length > 40 ? '…' : ''}</span><span class="pn-arrow">→</span></a>`
    : `<span class="pn-btn next disabled"><span>End of feed</span><span class="pn-arrow">→</span></span>`;
  const count = `<span class="pn-count">${index + 1} / ${total}</span>`;
  return `<div class="pn" data-pn="${position}">${prev}${count}${next}</div>`;
}

function metaRow(item, tag) {
  const pick = item.editorialPick ? `<span class="tag pick">★ PICK</span>` : '';
  const date = item.publishedAt ? item.publishedAt.slice(0, 10) : '';
  return `<div class="meta"><span class="tag ${TAG_CLASS[tag] || 'supply'}">${TAG_LABEL[tag] || 'SUPPLY'}</span>${pick}<span>${date}</span></div>`;
}

function verdictBox(item, tag) {
  const v = item.riImplication ||
    (item.editorialPick ? 'Editorial pick — selected by The RAM Index as material to the memory cycle.' : '');
  const score = item.signal ?? (item.editorialPick ? 10 : 6);
  const reasoning = item.reasoning || (item.editorialPick ? 'Editorial pick' : 'Deterministic signal from curated sources');
  return `<div class="note">
    <div class="note-h">RAM Index Note — what this means for the signal</div>
    <p>${esc(v || 'No verdict yet — pending the next annotation pass.')}</p>
    <div class="score">Signal <b>${score}/10</b> · ${esc(reasoning)}</div>
  </div>`;
}

function shareLinks(title, url) {
  const text = `The RAM Index: ${title} — ${url}`;
  const x = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  const li = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  return `<div class="share">
    <a href="${x}" target="_blank" rel="noopener noreferrer">Share on X</a>
    <a href="${li}" target="_blank" rel="noopener noreferrer">Share on LinkedIn</a>
    <button onclick="navigator.clipboard.writeText('${esc(text)}').then(()=>this.textContent='Copied ✓')">Copy link</button>
  </div>`;
}

function relatedBlock(related) {
  if (!related.length) return '';
  const rows = related.map(r =>
    `<a href="/stories/${r.slug}.html"><span class="r-date">${r.date}</span>${esc(r.title)}</a>`).join('');
  return `<div class="sec-h">Related — same signal</div><div class="related">${rows}</div>`;
}

function learnBlock(tag) {
  const lesson = LEARN_BY_TAG[tag];
  if (!lesson) return '';
  return `<div class="sec-h">Go deeper</div><div class="learn"><a href="/#learn">${esc(lesson.title)} →</a></div>`;
}

// ── Main ─────────────────────────────────────────────────────────────

function main() {
  if (!existsSync(FEED)) { console.error(`missing ${FEED}`); process.exit(1); }
  const items = parseFeed(readFileSync(FEED, 'utf8'))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  console.log(`stories: ${items.length} feed items`);

  const entries = items.map((item, index) => {
    const slug = storySlug(item);
    const url = storyUrl(item);
    const tag = item.tag || 'supply';
    const title = item.title || 'Untitled';
    // items is sorted newest-first: "prev" (published earlier) sits at the
    // next index, "next" (published later) sits at the previous index —
    // standard blog prev/next direction, not list-scan direction.
    const prevItem = items[index + 1] || null;
    const nextItem = items[index - 1] || null;
    // Defensive: older feed.xml entries can carry HTML-entity-escaped markup
    // in the excerpt (Google News descriptions aren't CDATA-wrapped, so the
    // ingestion-time strip can miss it) — strip it again here so a raw
    // <a href="..."> tag never renders as visible text on the story page.
    const cleanExcerpt = stripHtml(item.excerpt || '');
    const description = (item.riImplication || cleanExcerpt || 'The RAM Index Note on this story.').slice(0, 200);
    const canonical = `${SITE}${url}`;
    const external = cleanUrl(item.url);

    // Related: same tag first, then same source
    const related = items
      .filter((r) => r.url !== item.url && (r.tag === tag || r.sourceFeed === item.sourceFeed))
      .slice(0, 4)
      .map((r) => ({ slug: storySlug(r), title: r.title, date: (r.publishedAt || '').slice(0, 10) }));

    const html = pageHead(title, description, slug, item, canonical) +
      prevNextBar(prevItem, nextItem, 'top', index, items.length) +
      metaRow(item, tag) +
      `<h1>${esc(title)}</h1>` +
      `<div class="src">${esc(item.source || '')} · ${esc(item.sourceFeed || '')}</div>` +
      verdictBox(item, tag) +
      shareLinks(title, canonical) +
      `<div class="sec-h">The report</div>` +
      `<div class="excerpt">${esc(cleanExcerpt)}</div>` +
      `<div class="orig">Original article: <a href="${esc(external)}" target="_blank" rel="noopener noreferrer">Read on ${esc(item.source || 'the original source')} →</a></div>` +
      relatedBlock(related) +
      learnBlock(tag) +
      `<div class="sec-h">Keep browsing</div>` +
      prevNextBar(prevItem, nextItem, 'bottom', index, items.length) +
      pageFoot();

    return { slug, url, html, meta: {
      slug, url, title, tag,
      date: (item.publishedAt || '').slice(0, 10),
      score: item.signal ?? (item.editorialPick ? 10 : 6),
      pick: !!item.editorialPick,
      source: item.source || '',
      verdict: item.riImplication || '',
    } };
  });

  // ── Write story pages ────────────────────────────────
  let written = 0;
  for (const e of entries) {
    const file = resolve(STORIES_DIR, `${e.slug}.html`);
    if (!DRY_RUN) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, e.html); }
    written++;
  }

  // ── Purge orphan story pages from earlier runs ─────────
  if (!DRY_RUN && existsSync(STORIES_DIR)) {
    const current = new Set(entries.map((e) => e.slug));
    for (const f of readdirSync(STORIES_DIR)) {
      if (f === 'index.html') continue;
      if (f.endsWith('.html') && !current.has(f.replace(/\.html$/, ''))) {
        unlinkSync(resolve(STORIES_DIR, f));
      }
    }
  }

  // ── Archive page (filterable) ─────────────────────────
  const cards = entries.map((e) => e.meta);
  const archiveHtml = archivePage(cards);
  if (!DRY_RUN) {
    mkdirSync(STORIES_DIR, { recursive: true });
    writeFileSync(resolve(STORIES_DIR, 'index.html'), archiveHtml);
    mkdirSync(dirname(INDEX_JSON), { recursive: true });
    writeFileSync(INDEX_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), count: cards.length, stories: cards }, null, 2) + '\n');
  }
  console.log(`stories: wrote ${written} pages + archive + index json${DRY_RUN ? ' (dry-run)' : ''}`);
}

function archivePage(cards) {
  const rows = cards.map((c) => {
    const pick = c.pick ? ' <span class="tag pick">★</span>' : '';
    return `<div class="row" data-tag="${c.tag}" data-pick="${c.pick ? 1 : 0}">
      <span class="r-date">${c.date}</span>
      <a href="${c.url}">${esc(c.title)}</a><span class="r-tag">${TAG_LABEL[c.tag] || ''}</span>${pick}
    </div>`;
  }).join('');
  const chips = ['supply','demand','fab','earnings','macro'].map((t) =>
    `<button class="chip" data-filter="${t}">${TAG_LABEL[t]}</button>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>All Stories — The RAM Index</title>
<meta name="description" content="Every RAM Index Note — the memory market read through the Ramification Index lens.">
<meta property="og:title" content="All Stories — The RAM Index">
<meta property="og:description" content="Every RAM Index Note — the memory market read through the Ramification Index lens.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}
.row{display:flex;align-items:baseline;gap:10px;padding:9px 0;border-bottom:1px solid var(--line);font-size:13px;}
.row a:hover{color:var(--ram);}
.r-date{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:9px;color:var(--dim);white-space:nowrap;}
.r-tag{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:9px;color:var(--muted);margin-left:auto;text-transform:uppercase;}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0;}
.chip{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;padding:5px 10px;border:1px solid var(--line2);background:var(--bg1);color:var(--muted);cursor:pointer;border-radius:3px;}
.chip.active{color:var(--ram);border-color:var(--ram);}
.count{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;color:var(--dim);margin:10px 0;}
</style>
</head>
<body>
<header class="hd">
  <a class="hd-brand" href="/">RAM <em>INDEX</em></a>
  <nav class="hd-nav"><a href="/">Live Index</a><a href="/briefing/index.html">Briefing</a><a href="/feed.xml">RSS</a></nav>
</header>
<div class="wrap">
  <div class="meta"><span class="tag supply">ARCHIVE</span><span>All RAM Index Notes</span></div>
  <h1 style="font-size:20px;">The RAM Index — all stories</h1>
  <div class="count" id="count">${cards.length} notes</div>
  <div class="chips">
    <button class="chip active" data-filter="all">ALL</button>${chips}
    <button class="chip" data-filter="pick">★ PICKS</button>
  </div>
  <div id="rows">${rows}</div>
</div>
<script>
(function(){
  const chips = document.querySelectorAll('.chip');
  const rows = [...document.querySelectorAll('.row')];
  const count = document.getElementById('count');
  let filter = 'all';
  chips.forEach(c=>c.addEventListener('click',()=>{
    filter = c.dataset.filter;
    chips.forEach(x=>x.classList.toggle('active', x===c));
    const shown = rows.filter(r=> filter==='all' ? true : filter==='pick' ? r.dataset.pick==='1' : r.dataset.tag===filter);
    rows.forEach(r=>r.style.display='none');
    shown.forEach(r=>r.style.display='flex');
    count.textContent = shown.length + ' note' + (shown.length===1?'':'s');
  }));
})();
</script>
</body>
</html>`;
}

main();
