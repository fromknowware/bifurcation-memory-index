/**
 * <feed-tree src="https://ram-index.com/feed.xml"></feed-tree>
 *
 * Radial cluster tree built from an Atom feed.
 * Root → categories → top keywords extracted from item titles.
 *
 * Zero dependencies beyond D3 (loaded from CDN if not already present).
 * Drop-in web component — works in any HTML page.
 *
 * Attributes:
 *   src        Feed URL (required). CORS must allow the origin.
 *   max-terms  Max keywords per category leaf ring (default 8).
 *   theme      "dark" | "light" (default: inherits --bg, --text CSS vars or auto-detects)
 */

const STOP = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'by','from','as','is','was','are','were','be','been','has','have','had',
  'it','its','this','that','these','those','will','would','could','should',
  'may','might','can','do','does','did','not','no','new','up','s','vs',
  'after','amid','as','than','into','over','under','more','most','less',
  'about','amid','across','through','per','amid','amid','amid','set',
  'say','says','said','report','reports','amid','amid','amid','amid',
  'amid','amid','amid','amid','amid','amid','amid','amid','amid',
]);

const CATEGORY_COLORS = {
  supply:   '#6ea3c8',
  demand:   '#c86e6e',
  fab:      '#c8a86e',
  earnings: '#6ec882',
  macro:    '#9b6ec8',
};

const CATEGORY_LABELS = {
  supply: 'SUPPLY', demand: 'DEMAND', fab: 'FAB',
  earnings: 'EARNINGS', macro: 'MACRO',
};

function extractKeywords(titles, maxTerms) {
  const freq = new Map();
  for (const title of titles) {
    const words = title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOP.has(w));
    for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTerms)
    .map(([word, count]) => ({ word, count }));
}

function parseFeed(xml) {
  const byCategory = {};
  const entryRe = /<entry>([\s\S]*?)<\/entry>/gi;
  const titleRe = /<title[^>]*>([\s\S]*?)<\/title>/i;
  const catRe   = /<category[^>]+term="([^"]+)"/gi;
  let total = 0, m;

  while ((m = entryRe.exec(xml)) !== null) {
    total++;
    const block = m[1];
    const titleMatch = titleRe.exec(block);
    const title = titleMatch ? titleMatch[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"') : '';

    const cats = [];
    let cm;
    const catReLocal = /<category[^>]+term="([^"]+)"/gi;
    while ((cm = catReLocal.exec(block)) !== null) cats.push(cm[1]);

    const tagCat = cats.find(c => c.startsWith('tag:'));
    const tag = tagCat ? tagCat.slice(4) : 'supply';
    if (!byCategory[tag]) byCategory[tag] = [];
    if (title) byCategory[tag].push(title);
  }
  return { byCategory, total };
}

function buildHierarchy(byCategory, maxTerms) {
  return {
    name: 'FEED',
    children: Object.entries(byCategory).map(([cat, titles]) => ({
      name: cat,
      category: cat,
      count: titles.length,
      children: extractKeywords(titles, maxTerms).map(({ word, count }) => ({
        name: word,
        category: cat,
        count,
      })),
    })),
  };
}

// ── Web Component ─────────────────────────────────────────────────────────────

class FeedTree extends HTMLElement {
  static get observedAttributes() { return ['src', 'max-terms', 'theme']; }

  connectedCallback() {
    this._ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0 && !this._drawn) {
        this._drawn = true;
        this._render();
      }
    });
    this._ro.observe(this);
  }

  disconnectedCallback() { this._ro?.disconnect(); }

  attributeChangedCallback() {
    if (this.isConnected) { this._drawn = false; this._render(); }
  }

  /**
   * setData(items) — bypass fetch; pass pre-parsed items directly.
   * items: Array<{ title: string, tag: string }>
   */
  setData(items) {
    const byCategory = {};
    let total = 0;
    for (const item of items) {
      const tag = item.tag || 'supply';
      if (!byCategory[tag]) byCategory[tag] = [];
      if (item.title) { byCategory[tag].push(item.title); total++; }
    }
    this._preloaded = { byCategory, total };
    this._drawn = false;
    this._render();
  }

  async _render() {
    const src = this.getAttribute('src');
    if (!src && !this._preloaded) return;
    this._drawn = true;

    const maxTerms = parseInt(this.getAttribute('max-terms') || '8', 10);
    const explicitTheme = this.getAttribute('theme');

    // Detect theme from CSS vars or prefers-color-scheme
    const isDark = explicitTheme === 'dark' ||
      (!explicitTheme && (
        getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().startsWith('#0') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches
      ));

    const colors = {
      bg:      isDark ? 'transparent' : 'transparent',
      root:    isDark ? '#e8e8e6'     : '#1a1a18',
      branch:  isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
      label:   isDark ? '#b8b8b4'     : '#3a3a38',
      dim:     isDark ? '#6a6a66'     : '#9a9a96',
      link:    isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    };

    // Ensure D3 is available
    if (!window.d3) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }

    this.innerHTML = `<div class="ft-loading" style="font-family:monospace;font-size:11px;opacity:0.4;padding:24px;">Loading feed…</div>`;

    let byCategory, total;
    if (this._preloaded) {
      ({ byCategory, total } = this._preloaded);
    } else {
      let xml;
      try {
        const res = await fetch(src);
        xml = await res.text();
      } catch {
        this.innerHTML = `<div style="font-family:monospace;font-size:11px;opacity:0.4;padding:24px;">Feed unavailable</div>`;
        return;
      }
      ({ byCategory, total } = parseFeed(xml));
    }
    const hierarchy = buildHierarchy(byCategory, maxTerms);

    this._draw(hierarchy, total, colors, isDark);
  }

  _draw(hierarchy, total, colors, isDark) {
    const d3 = window.d3;
    // Render at a fixed logical size, scale via viewBox to fit container
    const W = 560, H = 560;
    const cx = W / 2, cy = H / 2;
    const outerRadius = Math.min(W, H) / 2 - 72;
    const innerRadius = outerRadius - 100;

    this.innerHTML = '';

    const svg = d3.select(this).append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('width', '100%')
      .style('height', '100%')
      .style('overflow', 'visible');

    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

    const root = d3.hierarchy(hierarchy);
    const cluster = d3.cluster().size([2 * Math.PI, innerRadius]).separation((a, b) => {
      // More space between category groups
      return (a.parent === b.parent ? 1 : 2) / a.depth;
    });
    cluster(root);

    // ── Links ──
    g.append('g').attr('fill', 'none')
      .attr('stroke', colors.link)
      .attr('stroke-width', 1)
      .selectAll('path')
      .data(root.links())
      .join('path')
      .attr('d', d3.linkRadial()
        .angle(d => d.x)
        .radius(d => d.y)
      );

    // ── Nodes ──
    const node = g.append('g')
      .selectAll('g')
      .data(root.descendants())
      .join('g')
      .attr('transform', d => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`);

    // Circle per node
    node.append('circle')
      .attr('r', d => {
        if (d.depth === 0) return 6;      // root
        if (d.depth === 1) return 4.5;    // category
        const maxCount = d3.max(d.parent.children, c => c.data.count) || 1;
        return 2 + (d.data.count / maxCount) * 3.5;
      })
      .attr('fill', d => {
        if (d.depth === 0) return colors.root;
        const cat = d.data.category;
        return CATEGORY_COLORS[cat] || colors.root;
      })
      .attr('opacity', d => d.depth === 2 ? 0.7 : 1);

    // Labels
    node.append('text')
      .attr('dy', '0.31em')
      .attr('x', d => d.x < Math.PI === !d.children ? 8 : -8)
      .attr('text-anchor', d => d.x < Math.PI === !d.children ? 'start' : 'end')
      .attr('transform', d => d.x >= Math.PI ? 'rotate(180)' : null)
      .text(d => {
        if (d.depth === 0) return 'RAM FEED';
        if (d.depth === 1) return `${CATEGORY_LABELS[d.data.name] || d.data.name} (${d.data.count})`;
        return d.data.name;
      })
      .attr('font-family', 'monospace, "Courier New"')
      .attr('font-size', d => {
        if (d.depth === 0) return '11px';
        if (d.depth === 1) return '10px';
        return '9px';
      })
      .attr('font-weight', d => d.depth <= 1 ? '600' : '400')
      .attr('fill', d => {
        if (d.depth === 0) return colors.root;
        if (d.depth === 1) return CATEGORY_COLORS[d.data.category] || colors.label;
        return colors.dim;
      })
      .attr('letter-spacing', d => d.depth === 1 ? '0.08em' : '0');

    // ── Root label (center) ──
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '3.5em')
      .attr('font-family', 'monospace')
      .attr('font-size', '9px')
      .attr('fill', colors.dim)
      .text(`${total} items`);
  }
}

customElements.define('feed-tree', FeedTree);
