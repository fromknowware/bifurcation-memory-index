---
title: "Ramification Index v3 — Self-Audit Executive Summary"
author: "Khayyam Wakil · Director, Knowware Institute"
date: "August 2026"
subtitle: "Paper under audit — Wakil, K. *The Ramification Index v3 (2026)* · SSRN #6726483 · Full audit at V3-METHODS.md"
---

## What this is

A self-audit of my own Ramification Index v3 paper, run using an 8-guard hostile-testing harness ported from an adjacent agricultural-indicator study (`ag-ram-index`) that killed four of my *publishable-looking* results by adding one more guard each time. Every figure in the full audit traces to `analysis/out/FACTS.txt`, verbatim run output pinned by 20 regression tests. This document sits alongside the paper, not in place of it.

## Headline finding #1 — the annual panel is UNDERPOWERED, not refuted

The published annual panel is n = 46 across three lags. The minimum partial correlation the panel can detect at 80% power under a Bonferroni-corrected α = 0.0167 is **0.508** — larger than almost any published macroeconomic leading indicator. Under this power constraint, the audit re-scores the RI as:

- **Guards 2 & 3 pass cleanly.** Reverse p = 0.499; forward/reverse F ratio = 5.78, well above the 2.0 dominance threshold. Direction is unambiguous.
- **Guard 5 passes** — and this is the guard v2 never ran. Adding the contemporaneous term retains **98.9%** of the F statistic (4.094 → 4.050). Whatever RI measures, it is *anticipation*, not persistence proxying for same-period co-movement.
- **Guard 1 fails narrowly.** p = 0.0243 against α = 0.0167.

**The honest label is UNTESTABLE, not NO LEAD.** A test with no power cannot reject anything. The correct verdict on the published annual panel is the same one the ag study applied to cartel-administered potash prices — an absence of a test, not a null. Monthly frequency would drop the detection floor from 0.508 to **0.192**; the binding constraint is data acquisition.

## Headline finding #2 — the public monthly proxy is not measuring DRAM

Guard 7 (independent-source substitution check) fires on the monthly track:

| Pair | n | r | Same good? |
|---|---|---|---|
| Public semi PPI vs the paper's own DRAM ASP | 46 | **0.186** | **No** |
| Semi PPI vs broader component-industry PPI | 498 | 0.655 | Yes |
| Semi PPI vs storage-device PPI | 402 | −0.024 | No |

The public semiconductor PPI and the Ramification Index do not move together. Every monthly result run on the public proxy is a statement about the semiconductor price complex *and not about DRAM ASP*. The McCallum archive was recovered from the Internet Archive and RI-M was built from it, correctly (point-in-time by proof, gap-aware, vintage-stamped) — but 21.6% of months carry unchanged values and the series correlates 0.133 with the import price index at monthly frequency. RI-M's null is uninformative in exactly the sense Guard 6 was written for: **the honest verdict is UNTESTABLE, not NO LEAD.**

## The theoretical payoff — a scope condition, not a case claim

The most useful non-statistical output of the audit is a *mechanism with a boundary*:

> DRAM leads because memory is bought by a few hundred capacity-planning firms ahead of deploying compute, so the purchase *is* a forward expectation expressed as a price. Agricultural inputs are bought by ~2M atomized price-takers on an agronomic calendar, funded by last season's cash — no agent expresses a forward expectation as a price, so the failure is structural.

This converts RI from *"DRAM happens to work"* into a **class of indicator with a testable scope condition**:

> **Concentrated buyers + discretionary forward commitment + fast, elastic, private-market price.**

Agriculture becomes a tested-and-failed *boundary case* rather than an unexamined gap. Farm machinery — financed capex, the closest structural analogue to DRAM — leads nothing either, sharpening the condition to *concentration* rather than merely *capex*. Neither the broad semiconductor price complex (§5) nor semiconductor output (§8) satisfies it. Whatever RI is measuring, **it is narrower than "semiconductors"**, and v3 has to say so.

This is the strongest thing to import, and it costs no new data.

---

# Data-integrity findings (published series)

Two findings on the RI series itself, discovered during the audit:

1. **Provenance overstatement in v2's README.** v1 documents the series as *"mid-year average retail for a typical mainstream module, **rounded**"* blended from McCallum + hblok.net + TrendForce. v2's README describes it as *"McCallum archive chain-linked to TrendForce DDR4 contract ASP"* — cleaner but not accurate. Correction issued in the audit; the r = 0.597 gap against the archive is documentation drift, not error.

2. **The 1988 RAM drought is missing from the published index.** v1's own §3 event table records 1988 as *"The Year of the RAM Drought … Prices spiked ~60% YoY"*, and the monthly archive shows $153/MB → $199/MB (March 1988) → $505/MB (July 1988). The published price table shows a *monotone decline* straight through. v2's central new claim — RAMageddon as *"a supply-side divergence regime without historical precedent"* — cannot be evaluated until 1988 is right, because the nearest historical precedent (post-dumping capacity-underinvestment shortage) is not in the series.

**Additional finding:** comparing v1's and v2's panels reveals that **only the 2026 row changed** between versions — by +86.9% ($0.0052 → $0.0097/MB). Every other year byte-identical. The forecast row is live and moving between versions, which is a Guard 4 (no-look-ahead) issue.

# What v3 needs, in order (the fix list)

1. **Acquire a monthly DRAM ASP series** (TrendForce or Counterpoint contract+spot). The binding constraint on everything else.
2. **Re-run the battery on it.** The harness is built and waiting.
3. **Publish the estimation code and the ASP series** so the headline Granger result is reproducible.
4. **Correlate the vendors' ASP series against each other**, not just against GDP (that's Guard 7).
5. **Run Guard 5 on the actual v2 quarterly specification.** It passes on the annual panel at 98.9% F retained — a real, reportable result.
6. **Audit `hbm_weight` and the 2018 chain-link** for point-in-time construction.
7. **Add a vintage column** to `indices-wide.csv`; mark 2026 provisional.
8. **Replace the NAND placebo** with one that fails the mechanism (passive components work; already in the battery).
9. **Downgrade the bifurcated index (ram_commodity_R + ram_ai_R) to descriptive**, or rebuild it quarterly. Currently n = 3 rows, one of which is a forecast — no inferential statistic is estimable.
10. **Write the scope condition into the theory section.**

Guards 1–3 v2 already passes, and leading with that is fair — provided 4–8 are run rather than asserted.

# What v2 passes cleanly (kept and stated)

Worth leading with, because it is genuinely uncommon:

1. **Reverse-direction testing** — v2 reports GDP → R (F = 2.14, p = 0.121). Most lead-lag claims never run it.
2. **F-dominance ratio** — 5.83 / 2.14 = **2.72**, above the 2.0 threshold. Stronger and more honest than "reverse was insignificant."
3. **Lag-order robustness** across p ∈ {1, 2, 3, 4} and Toda–Yamamoto.
4. **Having a placebo at all** — the ag study had none. The specific placebo needs replacing; the practice does not.

---

**Full audit:** the 12-section technical version is at `bifurcation-memory-index/V3-METHODS.md`, with all figures traceable to verbatim run output in `analysis/out/FACTS.txt`, and 20 regression tests pinning the guards in `analysis/tests/`.
