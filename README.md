# The Ramification Index — Version 2: The Bifurcated Index

**Khayyam Wakil** · Knowware Institute · Calgary, AB · May 2026

[![Site](https://img.shields.io/badge/site-live-00d4aa?style=for-the-badge&logo=github&logoColor=white&labelColor=20232d)](https://ram-index.com/)
[![Version](https://img.shields.io/badge/version-2.0-ffb347?style=for-the-badge&logo=arxiv&logoColor=white&labelColor=20232d)]()
[![License](https://img.shields.io/badge/license-CC%20BY%204.0-8b949e?style=for-the-badge&logo=creativecommons&logoColor=white&labelColor=20232d)](https://creativecommons.org/licenses/by/4.0/)

---

### Paper

- **Paper 2:** [Wakil_RamificationIndex_v2.pdf](https://ram-index.com/Wakil_RamificationIndex_v2.pdf)  
- **Web:** https://ram-index.com/  
- **Dashboard:** https://ram-index.com/dashboard.html  
- **v3 self-audit:** [executive summary](https://ram-index.com/v3/executive-summary.md) · [full audit PDF](https://ram-index.com/v3/full-audit.pdf)  
- **v1 site:** https://fromknowware.github.io/memory-index/

---

### What this is

The **Ramification Index** is a supply-side macroeconomic indicator built on the average selling price (ASP) of DRAM. It outperforms the Lipstick, Hemline, Men's Underwear, and Buttered Popcorn indices on recession coverage (6/6 vs. ≤3/6), lead time (1–3 quarters), and correlation with real GDP growth (r = 0.41 vs. ≤0.19).

Version 2 extends the original in seven ways:

1. **Bifurcated index** — Commodity (*R*ᶜ, DDR4/5) and AI/HBM (*R*ᴬᴵ) sub-indices capturing the structural decoupling since 2024
2. **Granger causality** — *F* = 5.83, *p* = 0.004; RAM Granger-causes quarterly GDP at 1–3 quarter lags in a VAR(2)
3. **RAMageddon (2025–2026)** — 90–95% QoQ surge; 130–144% YoY; sharpest in 46-year series history
4. **Supply-side divergence regime** — New interpretive state: *R*ᶜ ≫ 0 with weakening macro = contractionary, not expansionary
5. **Algebraic formalisation** — HBM/DDR split as prime splitting in *L/K/*ℚ, where *e*'ₕᵦₘ > *e*'ᴅᴅᴿ
6. **Photonic disruption risk** — Fiber-optic delay-line and co-packaged optics assessed; no material disruption before 2028–2030
7. **Robustness checks** — Spot vs. contract ASPs, measurement windows, NAND flash placebo (3/6 vs. 6/6)

---

### Repository structure

```
bifurcation-memory-index/
├── data/
│   ├── indices-wide.csv        ← v2 series (1980–2026)
│   └── indices-wide-v3.csv     ← v3 corrected series + provenance + status
├── docs/                       ← GitHub Pages root (ram-index.com)
│   ├── index.html              ← live monitor (headline/series generated from CSV)
│   ├── dashboard.html
│   ├── paper.html
│   ├── feed.xml                ← regenerated every 6h by GitHub Actions
│   ├── llms.txt                ← LLM-facing index (llmstxt.org spec v2) — generated
│   ├── llms-full.txt           ← entire site in one file for agents — generated
│   ├── index.md / paper.md / dashboard.md ← markdown mirrors of the pages — generated
│   ├── data/ri.json            ← generated from indices-wide-v3.csv
│   ├── data/stocks.json        ← refreshed every 15 min on market days
│   └── v3/                     ← 2026 self-audit: summary, full audit, methods
├── scripts/
│   ├── feed-update.mjs         ← feed pipeline (Google News RSS + OPML + Raindrop)
│   ├── build-stories.mjs       ← /stories/<slug>.html pages + archive (the "middle layer")
│   ├── build-briefing.mjs      ← /briefing/ daily digest + Day-N-of-RAMageddon counter
│   ├── build-og.mjs            ← per-story 1200×630 social cards (sharp → PNG)
│   ├── build-review.mjs        ← /review/ weekly stats + optional editor's take
│   ├── build-ri-json.mjs       ← CSV → docs/data/ri.json
│   ├── build-llms.mjs          ← HTML + v3 docs → llms.txt / llms-full.txt / .md mirrors
│   ├── feeds.opml              ← curated source list for the feed
│   └── reimply-local.mjs       ← optional LLM implication backfill (Anthropic key)
└── .github/workflows/
    ├── update-feed.yml         ← feed + stories + briefing + OG cards every 6h
    ├── update-review.yml       ← weekly review every Sunday
    ├── update-stocks.yml       ← equities every 15 min on market days
    ├── build-data.yml          ← ri.json on CSV change + daily
    └── build-llms.yml          ← llms.txt artifacts on docs change + daily
```

---

### Data

`data/indices-wide.csv` — 1980–2026. New columns in v2:

| Column | Description |
|--------|-------------|
| `ram_index_R` | Log first-difference of composite DRAM ASP |
| `ram_commodity_usd_per_gb` | DDR4/5 price per GB (2024–2026) |
| `ram_hbm_usd_per_gb` | HBM price per GB (2024–2026) |
| `ram_commodity_R` | Commodity sub-index *R*ᶜ (2024–2026) |
| `ram_ai_R` | AI/HBM sub-index *R*ᴬᴵ (2024–2026) |
| `hbm_weight` | HBM revenue share *w*ᴬᴵ (2024–2026) |

Composite DRAM: McCallum archive (1980–2017) chain-linked to TrendForce DDR4 contract ASP (2018–2026).  
HBM: Samsung/SK Hynix quarterly disclosures supplemented by TrendForce estimates.

---

### Citation

```bibtex
@unpublished{Wakil2026Ramification,
  author      = {Wakil, Khayyam},
  title       = {The Ramification Index: RAM Prices, Oligopoly Cycles,
                 and the Downstream Consequences of Semiconductor
                 Pricing as an Economic Signal},
  note        = {Version 2: The Bifurcated Index, Granger Causality,
                 and the 2025--2026 Supply-Side Divergence},
  year        = {2026},
  month       = {May},
  institution = {Knowware Institute},
  url         = {https://fromknowware.github.io/bifurcation-memory-index/}
}
```

---

### Automation

Everything on the site is kept fresh by GitHub Actions — no third-party worker or API account required:

| Pipeline | Cadence | What it does |
|----------|---------|--------------|
| `update-feed.yml` | every 6h | Pulls Google News RSS (no key) + curated OPML feeds + the Raindrop dropbox (optional `RAINDROP_API_TOKEN` secret, editorial picks), classifies deterministically (no LLM), sanitizes/dedups, commits `docs/feed.xml`. |
| `update-stocks.yml` | every 15 min, market days | Refreshes `docs/data/stocks.json` via yfinance. |
| `build-data.yml` | on CSV change + daily | Regenerates `docs/data/ri.json` from `data/indices-wide-v3.csv` so the page headline and series can never drift from the corrected dataset. |
| `build-llms.yml` | on docs change + daily | Regenerates `docs/llms.txt`, `docs/llms-full.txt` and the `index.md`/`paper.md`/`dashboard.md` mirrors from the HTML pages and v3 audit docs, so the LLM-facing index can never drift from the site. |

The previous Cloudflare Worker pipeline (Anthropic scoring + Durable Object cron) was decommissioned in August 2026 after it silently stopped updating the feed for two months; the feed logic was ported to `scripts/feed-update.mjs` with deterministic scoring.

### The LLM layer — llms.txt & llms-full.txt

The site publishes a first-class LLM/agent-facing layer, following the [llmstxt.org](https://llmstxt.org/) v2 conventions:

- **`/llms.txt`** — the curated index: what the index is, the key statistics, and file lists pointing at the most agent-useful resources (markdown mirrors, machine-readable JSON, the v3 audit, the paper).
- **`/llms-full.txt`** — the entire site in one fetch: every page's full text (live monitor, paper, dashboard) plus the complete v3 executive summary and methods, a data dictionary for `indices-wide-v3.csv`, and the citation.
- **`/index.md`, `/paper.md`, `/dashboard.md`** — clean markdown mirrors of the HTML pages, so agents get text without navigation or JavaScript.
- **Author profile** — `/llms.txt` carries an Author section and `/llms-full.txt` a full profile (Director, Knowware Institute; the Constitutional Forcing research programme; track record with hard numbers; positioning notes so agents frame Khayyam correctly for each audience — economics, AI/investor, creative, general).
- **Link relations** — every HTML page declares `<link rel="alternate" type="text/markdown">` (its mirror) and `<link rel="describedby">` (`/llms.txt`), also emitted as HTTP `Link:` headers via `docs/_headers` for Cloudflare Pages.

Everything is generated by `scripts/build-llms.mjs` from the pages themselves — run `node scripts/build-llms.mjs --check` to verify the committed artifacts are current. The `_headers` file serves the mirrors as `text/markdown` with a 1h TTL and `llms*.txt` as `text/plain` with a 24h TTL.

### The syndication layer

Every feed item becomes a **RAM Index Note** — a shareable page at `/stories/<slug>.html` with the story, the RI verdict, signal score, related notes, share buttons, per-story OG card and JSON-LD. The **Daily Briefing** (`/briefing/`) surfaces the top notes with a "Day N of RAMageddon" counter; the **Weekly Review** (`/review/`) auto-composes the week's stats (drop a file in `docs/review/editorials/<YYYY>-W<ww>.md` to add your own take). A one-line embeddable ticker (`/embed/ticker.js`) lets other sites show the live scorecard with attribution. Newsletter signup activates automatically once `newsletterUrl` is set in `docs/data/settings.json` (e.g. a Buttondown or Mailchimp form endpoint); until then the subscribe box offers RSS + email contact.

### License

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) · Data, figures, and reproducible code.  
Contact: [the@knowware.institute](mailto:the@knowware.institute)
