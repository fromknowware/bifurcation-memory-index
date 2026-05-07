# The Ramification Index — Version 2: The Bifurcated Index

**Khayyam Wakil** · The ARC Institute of Knowware · Calgary, AB · May 2026

[![Site](https://img.shields.io/badge/site-live-00d4aa?style=for-the-badge&logo=github&logoColor=white&labelColor=20232d)](https://fromknowware.github.io/bifurcation-memory-index/)
[![Version](https://img.shields.io/badge/version-2.0-ffb347?style=for-the-badge&logo=arxiv&logoColor=white&labelColor=20232d)]()
[![License](https://img.shields.io/badge/license-CC%20BY%204.0-8b949e?style=for-the-badge&logo=creativecommons&logoColor=white&labelColor=20232d)](https://creativecommons.org/licenses/by/4.0/)

---

### Paper

- **Paper 2:** [Wakil_RamificationIndex_v2.pdf](https://fromknowware.github.io/bifurcation-memory-index/Wakil_RamificationIndex_v2.pdf)  
- **Web:** https://fromknowware.github.io/bifurcation-memory-index/  
- **Dashboard:** https://fromknowware.github.io/bifurcation-memory-index/dashboard.html  
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
├── paper-arxiv/
│   ├── Wakil_RamificationIndex_v2_arXiv.pdf
│   ├── Wakil_RamificationIndex_v2_arXiv.tex
│   └── references.bib
├── data/
│   └── indices-wide.csv        ← 1980–2026, includes bifurcated sub-index columns
└── docs/                       ← GitHub Pages root
    ├── index.html
    ├── dashboard.html
    └── ramification-v2-arxiv.pdf
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
  institution = {The ARC Institute of Knowware},
  url         = {https://fromknowware.github.io/bifurcation-memory-index/}
}
```

---

### License

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) · Data, figures, and reproducible code.  
Contact: [the@knowware.institute](mailto:the@knowware.institute)
