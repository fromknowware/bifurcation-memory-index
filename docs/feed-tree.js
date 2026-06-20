/**
 * <feed-tree> — D3 treemap with three lenses
 *
 * TOPICS  — keyword frequency grouped by category (nested squarify)
 * SOURCES — publication coverage by item count
 * PICKS   — editorial picks vs auto-surfaced signal items
 *
 * Usage:
 *   <feed-tree></feed-tree>
 *   el.setData(items)   items: { title, tag, source, editorialPick, riImplication? }[]
 *
 * Drop in any page. Reads CSS vars --bg1, --bg, --text, --dim, --mono if present.
 */

const STOP = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by','from',
  'as','is','was','are','were','be','been','has','have','had','it','its','this','that',
  'these','those','will','would','could','should','may','might','can','do','does','did',
  'not','no','new','up','s','vs','after','amid','than','into','over','under','more',
  'most','less','about','across','through','per','set','say','says','said','report',
  'reports','amid','also','its','their','which','who','what','when','where','why','how',
]);

const CAT_COLOR = {
  supply:   '#5a8fb8',
  demand:   '#b85a5a',
  fab:      '#b8985a',
  earnings: '#5ab870',
  macro:    '#8a5ab8',
};

const CAT_LABEL = {
  supply: 'SUPPLY', demand: 'DEMAND', fab: 'FAB', earnings: 'EARNINGS', macro: 'MACRO',
};

function keywords(texts, n = 12) {
  const freq = new Map();
  for (const t of texts) {
    for (const w of t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
      if (w.length > 3 && !STOP.has(w)) freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ name: k, value: v }));
}

// ── Lens builders ──────────────────────────────────────────────────────────

function buildTopics(items) {
  const byTag = {};
  for (const item of items) {
    const tag = item.tag || 'supply';
    if (!byTag[tag]) byTag[tag] = [];
    byTag[tag].push(item.title || '');
  }
  return {
    name: 'root',
    children: Object.entries(byTag).map(([tag, titles]) => ({
      name: tag,
      color: CAT_COLOR[tag],
      label: CAT_LABEL[tag] || tag.toUpperCase(),
      children: keywords(titles, 14).map(kw => ({ ...kw, tag, color: CAT_COLOR[tag] })),
    })).filter(g => g.children.length),
  };
}

function buildSources(items) {
  const freq = new Map();
  const tagBySource = new Map();
  for (const item of items) {
    const src = (item.source || 'unknown').replace(/^www\./, '');
    freq.set(src, (freq.get(src) || 0) + 1);
    if (!tagBySource.has(src)) tagBySource.set(src, item.tag || 'supply');
  }
  const children = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([name, value]) => ({ name, value, tag: tagBySource.get(name), color: CAT_COLOR[tagBySource.get(name)] || CAT_COLOR.supply }));
  return { name: 'root', children };
}

function buildPicks(items) {
  const picks    = items.filter(i => i.editorialPick);
  const autofeed = items.filter(i => !i.editorialPick);
  return {
    name: 'root',
    children: [
      {
        name: 'editorial',
        label: '★ PICKS',
        color: '#c8a040',
        children: keywords(picks.map(i => `${i.title} ${i.riImplication || ''}`), 16)
          .map(kw => ({ ...kw, color: '#c8a040' })),
      },
      {
        name: 'signal',
        label: 'SIGNAL',
        color: '#5a8fb8',
        children: keywords(autofeed.map(i => `${i.title} ${i.riImplication || ''}`), 16)
          .map(kw => ({ ...kw, color: '#5a8fb8' })),
      },
    ].filter(g => g.children.length),
  };
}

// ── Renderer ───────────────────────────────────────────────────────────────

const LENSES = [
  { id: 'topics',  label: 'TOPICS' },
  { id: 'sources', label: 'SOURCES' },
  { id: 'picks',   label: 'PICKS' },
];

function renderTreemap(container, data, W, H) {
  const d3 = window.d3;

  // Detect if data is nested (has grandchildren) or flat
  const isNested = data.children?.some(c => c.children);

  const root = isNested
    ? d3.hierarchy(data).sum(d => d.value || 0).sort((a, b) => b.value - a.value)
    : d3.hierarchy(data).sum(d => d.value || 0).sort((a, b) => b.value - a.value);

  d3.treemap()
    .size([W, H])
    .tile(d3.treemapSquarify.ratio(1.4))
    .paddingOuter(isNested ? 3 : 2)
    .paddingTop(isNested ? 18 : 0)
    .paddingInner(1)
    (root);

  const svg = d3.create('svg').attr('width', W).attr('height', H);

  // ── Group backgrounds (categories) ──
  if (isNested) {
    svg.selectAll('.cat-bg')
      .data(root.children || [])
      .join('rect')
      .attr('class', 'cat-bg')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .attr('fill', d => d.data.color || '#444')
      .attr('fill-opacity', 0.12);

    // Category label
    svg.selectAll('.cat-label')
      .data(root.children || [])
      .join('text')
      .attr('class', 'cat-label')
      .attr('x', d => d.x0 + 5)
      .attr('y', d => d.y0 + 12)
      .text(d => `${d.data.label || d.data.name.toUpperCase()}  ${d.data.children?.length || ''}`)
      .attr('fill', d => d.data.color || '#888')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .attr('letter-spacing', '0.08em')
      .attr('opacity', 0.9);
  }

  // ── Leaf rectangles ──
  const leaves = root.leaves();

  const cell = svg.selectAll('.cell')
    .data(leaves)
    .join('g')
    .attr('class', 'cell')
    .attr('transform', d => `translate(${d.x0},${d.y0})`);

  cell.append('rect')
    .attr('width', d => Math.max(0, d.x1 - d.x0))
    .attr('height', d => Math.max(0, d.y1 - d.y0))
    .attr('fill', d => d.data.color || CAT_COLOR[d.data.tag] || '#5a8fb8')
    .attr('fill-opacity', d => {
      const area = (d.x1 - d.x0) * (d.y1 - d.y0);
      return 0.18 + Math.min(0.55, area / 18000);
    })
    .attr('rx', 1);

  // Label: only if rect is wide enough
  cell.each(function(d) {
    const W = d.x1 - d.x0, H = d.y1 - d.y0;
    if (W < 28 || H < 14) return;

    const g = d3.select(this);
    const fontSize = Math.min(12, Math.max(8, Math.sqrt(W * H) / 8));
    const text = d.data.name;

    // Clip to rect bounds
    const clipId = `clip-${Math.random().toString(36).slice(2)}`;
    g.append('clipPath').attr('id', clipId)
      .append('rect').attr('width', W - 4).attr('height', H - 4).attr('x', 2).attr('y', 2);

    g.append('text')
      .attr('clip-path', `url(#${clipId})`)
      .attr('x', 5)
      .attr('y', H / 2 + fontSize * 0.35)
      .text(text)
      .attr('font-size', `${fontSize}px`)
      .attr('font-family', 'monospace,"Courier New"')
      .attr('fill', d.data.color || CAT_COLOR[d.data.tag] || '#8fb8d8')
      .attr('opacity', 0.92);

    // Value badge for large cells
    if (W > 60 && H > 32 && d.data.value > 1) {
      g.append('text')
        .attr('x', W - 5)
        .attr('y', H - 5)
        .text(d.data.value)
        .attr('font-size', '8px')
        .attr('font-family', 'monospace')
        .attr('fill', d.data.color || '#8fb8d8')
        .attr('opacity', 0.45)
        .attr('text-anchor', 'end');
    }
  });

  return svg.node();
}

// ── Web Component ──────────────────────────────────────────────────────────

class FeedTree extends HTMLElement {
  connectedCallback() {
    this._lens = 'topics';
    this._ro = new ResizeObserver(() => { if (this._items) this._draw(); });
    this._ro.observe(this);
    this.style.display = 'block';
    this._buildShell();
  }

  disconnectedCallback() { this._ro?.disconnect(); }

  setData(items) {
    this._items = items;
    this._draw();
  }

  _buildShell() {
    // Lens button bar
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:6px;padding:10px 14px 0;align-items:center;';

    const label = document.createElement('span');
    label.style.cssText = 'font-family:monospace;font-size:9px;letter-spacing:0.1em;color:var(--dim,#666);margin-right:6px;';
    label.textContent = 'VIEW';
    bar.appendChild(label);

    this._btns = {};
    for (const lens of LENSES) {
      const btn = document.createElement('button');
      btn.textContent = lens.label;
      btn.dataset.lens = lens.id;
      btn.style.cssText = [
        'font-family:monospace;font-size:9px;letter-spacing:0.08em;',
        'padding:3px 8px;border-radius:2px;cursor:pointer;',
        'border:1px solid var(--line2,rgba(255,255,255,0.12));',
        'background:none;transition:all 0.12s;',
      ].join('');
      btn.addEventListener('click', () => {
        this._lens = lens.id;
        this._updateBtns();
        this._draw();
      });
      this._btns[lens.id] = btn;
      bar.appendChild(btn);
    }

    this._canvas = document.createElement('div');
    this._canvas.style.cssText = 'flex:1;min-height:0;overflow:hidden;';

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;height:100%;';
    wrap.appendChild(bar);
    wrap.appendChild(this._canvas);

    this.innerHTML = '';
    this.appendChild(wrap);
    this._updateBtns();
    this._bar = bar;
    this._barH = 34;
  }

  _updateBtns() {
    for (const [id, btn] of Object.entries(this._btns)) {
      const active = id === this._lens;
      btn.style.color    = active ? 'var(--text,#e8e8e6)' : 'var(--dim,#666)';
      btn.style.borderColor = active ? 'var(--line,rgba(255,255,255,0.25))' : 'var(--line2,rgba(255,255,255,0.1))';
      btn.style.background  = active ? 'var(--bg2,rgba(255,255,255,0.06))' : 'none';
    }
  }

  async _draw() {
    if (!this._items?.length || !this._canvas) return;

    // Ensure D3
    if (!window.d3) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }

    const W = this.clientWidth  || 800;
    const H = (this.clientHeight || 300) - this._barH;
    if (W < 10 || H < 10) return;

    let data;
    if (this._lens === 'sources') data = buildSources(this._items);
    else if (this._lens === 'picks') data = buildPicks(this._items);
    else data = buildTopics(this._items);

    // Check we have real data
    const total = (data.children || []).reduce((s, c) => s + (c.children?.reduce((ss, cc) => ss + cc.value, 0) ?? c.value ?? 0), 0);
    if (!total) {
      this._canvas.innerHTML = '<div style="font-family:monospace;font-size:10px;opacity:0.3;padding:20px;">No data</div>';
      return;
    }

    const svgNode = renderTreemap(this._canvas, data, W, H);
    this._canvas.innerHTML = '';
    this._canvas.appendChild(svgNode);
  }
}

customElements.define('feed-tree', FeedTree);
