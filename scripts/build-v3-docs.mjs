#!/usr/bin/env node
/**
 * build-v3-docs.mjs — render docs/v3/*.md into on-brand, styled HTML pages.
 *
 * GitHub Pages runs Jekyll by default, which silently converts every .md
 * file in docs/ into its own generic-themed .html — and for files with
 * front matter (like executive-summary.md), it *only* emits the .html,
 * so the literal .md URL 404s. docs/.nojekyll (added alongside this
 * script) turns that off; these are the real, committed replacements,
 * styled to match the rest of ram-index.com instead of Jekyll's default
 * theme.
 *
 *   npm install --prefix scripts marked   (one-time, not committed — see
 *                                          fetch_stocks.py's sharp install
 *                                          for the same pattern)
 *   node scripts/build-v3-docs.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const V3 = resolve(ROOT, 'docs/v3');

marked.setOptions({ gfm: true, breaks: false });

function parseFrontMatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: md };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*"?(.*?)"?\s*$/);
    if (kv) meta[kv[1]] = kv[2];
  }
  return { meta, body: m[2] };
}

function firstH1(md) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function page({ title, subtitleHtml, byline, mdHref, bodyHtml }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title} — RAM Monitor</title>
<meta name="description" content="${escapeAttr(title)}">
<link rel="alternate" type="text/markdown" title="Markdown version" href="${mdHref}">
<style>
  :root {
    --bg: #0b0c10; --panel: #141620; --panel2: #1a1d28;
    --border: #20232d; --border2: #2a2f3e;
    --text: #c9d3e8; --muted: #8a8f9b; --white: #fff;
    --ram: #ffb347; --hbm: #00d4aa; --red: #f87171; --green: #4ade80;
    --radius: 6px; --max: 760px;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    line-height: 1.7; font-size: 16px;
  }
  header {
    padding: 16px 24px; border-bottom: 1px solid var(--border);
    background: var(--panel); display: flex; align-items: center; justify-content: space-between;
    gap: 12px; flex-wrap: wrap; position: sticky; top: 0; z-index: 5;
  }
  .h-pill {
    font-size: 11px; font-weight: 600; padding: 5px 13px; border-radius: 99px;
    text-decoration: none; border: 1px solid var(--border2); color: var(--muted);
    font-family: ui-monospace, "SF Mono", Menlo, monospace; letter-spacing: 0.02em;
    transition: all .15s; white-space: nowrap;
  }
  .h-pill:hover { color: var(--text); border-color: rgba(255,255,255,0.2); }
  .h-tag { font-size: 11px; color: var(--muted); font-family: ui-monospace, monospace; letter-spacing: .04em; }
  main { max-width: var(--max); margin: 0 auto; padding: 48px 24px 90px; }
  .doc-title { font-size: 2rem; font-weight: 800; letter-spacing: -0.02em; color: var(--white); margin: 0 0 10px; line-height: 1.2; }
  .doc-subtitle { font-size: 0.95rem; color: var(--muted); line-height: 1.6; margin: 0 0 6px; }
  .doc-subtitle em { color: var(--text); }
  .doc-byline { font-size: 0.82rem; color: var(--ram); font-family: ui-monospace, monospace; margin: 18px 0 40px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }
  main h2 { font-size: 1.4rem; font-weight: 700; color: var(--white); margin: 2.6em 0 0.7em; letter-spacing: -0.01em; }
  main h3 { font-size: 1.12rem; font-weight: 700; color: var(--text); margin: 2em 0 0.6em; }
  main p { margin: 0 0 1.15em; }
  main ul, main ol { margin: 0 0 1.15em; padding-left: 1.4em; }
  main li { margin-bottom: 0.4em; }
  main li > p { margin-bottom: 0.4em; }
  main a { color: var(--hbm); text-decoration: none; border-bottom: 1px solid rgba(0,212,170,0.3); }
  main a:hover { border-bottom-color: var(--hbm); }
  main strong { color: var(--white); font-weight: 700; }
  main em { color: var(--text); }
  main blockquote {
    margin: 1.6em 0; padding: 0.2em 1.2em; border-left: 3px solid var(--ram);
    background: rgba(255,179,71,0.05); color: var(--text); font-style: italic;
  }
  main blockquote p:last-child { margin-bottom: 0; }
  main code {
    font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.87em;
    background: var(--panel2); border: 1px solid var(--border2); border-radius: 4px; padding: 0.15em 0.4em;
  }
  main pre {
    background: var(--panel2); border: 1px solid var(--border2); border-radius: var(--radius);
    padding: 14px 16px; overflow-x: auto; margin: 1.5em 0;
  }
  main pre code { background: none; border: none; padding: 0; font-size: 0.85em; line-height: 1.55; }
  main table { width: 100%; border-collapse: collapse; margin: 1.6em 0; font-size: 0.88rem; display: block; overflow-x: auto; }
  main th, main td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--border); }
  main thead th { color: var(--muted); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; background: var(--panel2); }
  main hr { border: none; border-top: 1px solid var(--border); margin: 2.4em 0; }
  main img { max-width: 100%; border-radius: var(--radius); }
  footer { text-align: center; padding: 20px; font-size: 11px; color: var(--muted); border-top: 1px solid var(--border); }
  footer a { color: var(--hbm); text-decoration: none; }
  footer a:hover { text-decoration: underline; }
  @media (max-width: 600px) { main { padding: 32px 18px 70px; } .doc-title { font-size: 1.5rem; } }
</style>
</head>
<body>
<header>
  <a class="h-pill" href="../index.html">← RAM Monitor</a>
  <span class="h-tag">v3 self-audit</span>
</header>
<main>
  <h1 class="doc-title">${title}</h1>
  ${subtitleHtml ? `<p class="doc-subtitle">${subtitleHtml}</p>` : ''}
  <div class="doc-byline">${byline}</div>
  ${bodyHtml}
</main>
<footer>
  Khayyam Wakil &nbsp;·&nbsp; Knowware Institute &nbsp;·&nbsp;
  <a href="../index.html">RAM Monitor</a> &nbsp;·&nbsp; <a href="../paper.html">Paper</a> &nbsp;·&nbsp;
  <a href="https://github.com/fromknowware/bifurcation-memory-index">GitHub</a>
</footer>
</body>
</html>
`;
}

function buildOne(filename) {
  const src = readFileSync(resolve(V3, filename), 'utf8');
  const { meta, body } = parseFrontMatter(src);
  const title = meta.title || firstH1(body) || filename;
  // If there's no front-matter title, the body's own H1 becomes the page
  // title above — strip it from the body so it isn't rendered twice.
  const bodyContent = meta.title ? body : body.replace(/^#\s+.+\n+/, '');
  const bodyHtml = marked.parse(bodyContent);
  const byline = meta.author
    ? `${meta.author}${meta.date ? ' · ' + meta.date : ''}`
    : 'Khayyam Wakil · Director, Knowware Institute';
  const subtitleHtml = meta.subtitle ? marked.parseInline(meta.subtitle) : null;

  const html = page({
    title,
    subtitleHtml,
    byline,
    mdHref: `/v3/${filename}`,
    bodyHtml,
  });
  const outName = filename.replace(/\.md$/, '.html');
  writeFileSync(resolve(V3, outName), html);
  console.log(`wrote docs/v3/${outName}`);
}

buildOne('executive-summary.md');
buildOne('methods.md');
