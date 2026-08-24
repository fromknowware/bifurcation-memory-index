# v3 methods — the ag-ram-index harness, ported and run

**Status: harness built, battery run, results below.** Every figure here traces
to [`analysis/out/FACTS.txt`](analysis/out/FACTS.txt), which is verbatim run
output. That convention is inherited from `ag-ram-index/papers/FACTS.txt` and
exists so a number cannot drift between the code and the prose.

```bash
.venv/bin/python analysis/battery.py > analysis/out/FACTS.txt
```

```bash
cd analysis && ../.venv/bin/python -m pytest -q
```

Source of the method: `~/claude-code/ag-ram-index`, which tested six candidate
agricultural leading indicators, found none, and produced **four results that
looked publishable and were wrong**. Each survived every check in place at the
time and died only when a further guard was added. Those guards are now in
[`analysis/ri_leadtest/leadtest.py`](analysis/ri_leadtest/leadtest.py), pinned
by 20 regression tests.

---

## 1. Headline

**Nothing in the public semiconductor price complex leads the macroeconomy once
the guards are applied, and the published Ramification Index panel is too small
to tell either way.** Those are different findings and the difference is the
whole point of §4.

The one thing that survived every guard in the agricultural study was a mirage
created by the data vendor. The equivalent check here (§3) says the public
monthly proxy is **not measuring DRAM** — so the monthly track, which is the
thing you remembered wanting, is currently blocked on data acquisition rather
than on method.

## 2. On the monthly question

I could not recover the original remark. The `ag-ram-index` session transcripts
are not on this machine (`~/.claude/projects/` has no entry for that directory),
and a full-text search across every other local transcript returns nothing.
So the following is reconstruction from the artifacts, not recall.

The case for monthly is strong and the ag repo makes it implicitly everywhere:
**every substantive test in that study ran on monthly data** — 554 months of
potash, 792 of Pink Sheet prices, 826 of heifer slaughter, 992 of fertilizer.
The harness is built for that frequency. Three of its guards are barely
estimable without it:

- point-in-time orthogonalization has a **120-observation burn-in** before it
  emits a single residual;
- the contemporaneous control fits `2k+1` regressors and needs residual degrees
  of freedom to spare;
- a 12-lag Bonferroni sweep at α = 0.00417 needs real power behind it.

The published RI panel is **annual, n = 46**. That is not enough for any of them.

### What monthly is actually worth — the power calculation

Minimum partial correlation detectable at 80% power against the
Bonferroni-corrected α, by panel:

| Panel | n | lags | α | min detectable partial *r* |
|---|---|---|---|---|
| Published annual panel | 46 | 3 | 0.0167 | **0.508** |
| v2 quarterly window 1985–2024 | 160 | 8 | 0.00625 | 0.360 |
| Full quarterly | 237 | 8 | 0.00625 | 0.299 |
| **Monthly** | 712 | 12 | 0.00417 | **0.192** |

The annual panel cannot see anything smaller than a partial correlation of
**0.51**. That is an enormous macroeconomic effect — larger than almost any
published leading indicator. Monthly drops the floor to **0.19**.

This reframes the annual result completely. See §4.

### The blocker

There is **no free monthly DRAM ASP series.** TrendForce / DRAMeXchange is
commercial. And the McCallum archive cited in the v2 paper —
`jcmit.net/memoryprice.htm` — **no longer resolves to the archive**; the domain
now serves unrelated commercial content, and the Wayback copy is behind a
challenge page. A paper whose primary 1980–2017 source has gone dark has a
reproducibility problem independent of any of this.

So the monthly battery had to run on the closest public monthly price series,
`PCU334413334413` (PPI: Semiconductor & Related Device Manufacturing, 713
months, 1967–2026) — and then Guard 7 was run to find out whether that was
legitimate. It was not. See §3.

## 3. Guard 7 killed the substitution — exactly as it did in agriculture

The last survivor of the agricultural study died on the discovery that two crop
series from independent providers correlate **0.794** while the two fertilizer
series correlate **0.175**: they were not measuring the same good, and the lead
followed the vendor rather than the economy.

Run here, on annual log-differences over the common 1981–2026 span:

| Pair | n | r | same good? |
|---|---|---|---|
| **Public semi PPI vs the paper's own DRAM ASP** | 46 | **0.186** | **no** |
| semi PPI vs broader component-industry PPI | 498 | 0.655 | yes |
| semi PPI vs electronic-components commodity PPI | 712 | 0.519 | no |
| semi PPI vs its own product-line index | 599 | 0.286 | no |
| semi PPI vs storage-device PPI | 402 | −0.024 | no |

**0.186.** Effectively the fertilizer number. The public semiconductor PPI and
the Ramification Index do not move together, so every monthly result in
§5 is a statement about the semiconductor price complex and **not** about DRAM
ASP. It can neither confirm nor refute v2.

Two further readings worth having:

- Even *within* BLS, two constructions of semiconductor prices correlate 0.286.
  "The semiconductor price" is not a well-defined single object. Any v3 claim
  about DRAM must name its series and show the substitution test.
- v2's existing three-vendor check (Gartner / TrendForce / Counterpoint,
  r = 0.38–0.44 against GDP) compares *correlations with GDP*, not the ASP
  series with each other. Those are different tests and only the second one is
  Guard 7. **The vendors' ASP series need to be correlated against each other.**

## 4. The published index: underpowered, not refuted

The only track that uses the actual Ramification Index as published:

```
ram_index_R -> real GDP growth, annual, n = 46, 3 lags
  best forward:  lag 2, F = 4.09, p = 0.0243
  reverse:       lag 2,           p = 0.499     (F ratio 5.78)
  Bonferroni α = 0.0167
  VERDICT: NO LEAD — p = 0.0243 fails α = 0.0167
```

Read the components rather than the verdict:

- **Guard 2/3 pass cleanly.** Reverse p = 0.499, forward/reverse F ratio 5.78,
  well above the 2.0 dominance threshold. The direction is unambiguous.
- **Guard 5 passes** — and this is the guard v2 has never run and the one I
  expected to do the damage. Adding the contemporaneous term retains **98.9%**
  of the F statistic (4.094 → 4.050, p = 0.025). Whatever this is, it is
  anticipation, not persistence proxying for same-period co-movement. Contrast
  the ag study's heifer result, which retained so little it died outright.
- **Guard 1 fails, narrowly.** p = 0.0243 against α = 0.0167.
- Dropping the forecast row (§6) barely moves it: p = 0.0330, 99.9% F retained.

Now combine that with the power table: this panel could only have detected a
partial correlation of 0.51 or larger. **A test with no power cannot reject
anything.** The correct label for the published annual panel is not NO LEAD; it
is *underpowered*, and the ag study has a name for that class of outcome —
UNTESTABLE, the verdict it gave potash prices rather than reporting a null.

This is the strongest argument for monthly, and it is a constructive one: the RI
is not failing the guards. It is failing to have enough observations to face
them.

## 5. What the monthly battery found (about semiconductors, not DRAM)

Caveat from §3 applies to everything here.

| Test | n | Verdict |
|---|---|---|
| semi PPI → INDPRO | 712 | NO LEAD (p = 0.0122 vs α = 0.00417) |
| semi PPI → PAYEMS | 712 | NO LEAD (p = 0.329) |
| semi PPI ex-PPIACO, point-in-time → INDPRO | 592 | NO LEAD (p = 0.0163) |
| semi PPI → real GDP, quarterly | 237 | NO LEAD (p = 0.046) |
| semi PPI → real GDP, **v2's own 1985–2024 window** | 160 | NO LEAD (p = 0.155) |

And every one of them **dies under Guard 5** — the lag block never survives the
contemporaneous term. Monthly signal autocorrelation is only ρ₁ = 0.161, so this
is not a persistence artifact; there is simply nothing there.

### The YoY contrast

`semi PPI → INDPRO`: log-diff p = 0.0122, YoY p = 0.0345. `semi PPI → PAYEMS`:
the forward/reverse F ratio swings from **140.2 under log-differences to 0.27
under YoY** — the transform inverts the apparent direction of the relationship.
Neither verdict changes here, but the machinery that flipped the ag study's
conclusions is demonstrably live in this data. A synthetic test pinning the
effect is in the test suite (`test_yoy_transform_manufactures_a_lead_that_logdiff_denies`).

### The placebos, and a problem with v2's

Capacitor and resistor PPIs — commodity passives, bought short-lead against
realised orders — return clean nulls (p = 0.443, p = 0.328). Good.

**The storage-device PPI leads INDPRO at 8 months (p = 4.4e-04, F ratio 7.89)
and is the only price series in the entire run that survives Guard 5** (85.1% F
retained, controlled p = 0.030).

That is a problem for v2's robustness section, in two ways. Empirically, v2
reports NAND as a *failing* placebo (3/6 recessions vs 6/6); here the storage
analogue outperforms the semiconductor signal. Structurally, it was never a
valid placebo to begin with: v2's own mechanism is that DRAM leads because a few
hundred capacity-planning firms buy it ahead of deploying compute. NAND is
bought by *the same firms, for the same deployments, on the same planning
horizon*. On v2's own argument NAND should lead too. A placebo has to fail the
mechanism, not merely be a different product.

## 6. Guard 4 audit of the published panel

**The last row is a forecast.** `data/indices-wide.csv` is annual and ends at
2026, constructed part-way through 2026:

| | ram_index_R | hbm_weight | real_gdp_yoy | unemp_u3 | sp500_close |
|---|---|---|---|---|---|
| 2024 | 0.477 | 0.18 | 2.8 | 4.0 | 5881.63 |
| 2025 | 0.346 | 0.30 | 2.2 | 4.1 | 6089.54 |
| **2026** | **0.863** | **0.42** | **1.5** | **4.4** | **5995** |

Every 2026 value is a projection standing in a column of realised history. Guard
4 says a value at *t* must not depend on information unavailable at *t*; a
forecast is the limiting case. The panel should carry a vintage column, or the
2026 row should be marked as provisional. The estimates are reported both ways
in FACTS.txt and the difference is small — but "small" was not knowable in
advance, which is the argument for the discipline rather than against it.

**Still unaudited, because the inputs are not in this repo:** the `hbm_weight`
series (is the HBM revenue share a point-in-time estimate or a retrospective
one?) and the 2018 McCallum→TrendForce chain-link (is the splice ratio computed
on overlap that runs past the observation date?). These remain the two highest
Guard-4 risks in v2 and neither can be checked from what is published.

**On the look-ahead penalty itself:** fitting the confound regression on the
full sample vs point-in-time moved the best forward F from 5.219 to 5.806 — the
leak *deflated* the statistic here, where in the ag study the same correction
cost half the result (36.0 → 17.8). The direction of the bias is not
predictable. Point-in-time construction is a correctness requirement, not a
haircut you can estimate and apply afterwards.

## 7. Guard 8 — a new one, added here

**Check for definitional overlap before interpreting a lead.**

Semiconductor industrial production (`IPG3344S`, NAICS 3344) against INDPRO
produces `LEADS at 2m, p = 1.9e-08, F ratio 15.17` — the largest statistic in
the entire run. It is also an accounting identity: IPG3344S is *a component of*
INDPRO. Nothing was predicted.

The agricultural harness has no guard for this because its signals and targets
came from different agencies measuring different things. In semiconductors the
signal and the macro target are routinely built by the same statistical agency
from overlapping source data, so the trap is live. It is now documented in the
battery as the worked example.

## 8. The potash lesson, applied and closed out

Under administered pricing the market clears through quantity, so volume is the
instrument — the recognition that turned an uninformative potash null into a
real rejection. The DRAM analogue is semiconductor output. Non-circular targets:

| Test | n | Granger verdict | Guard 5 |
|---|---|---|---|
| semi IP → PAYEMS | 653 | LEADS at 2m (p = 0.0018) | **DIES** — 44.6% F retained, p = 0.35 |
| semi IP → real GDP | 217 | LEADS at 1q (p = 0.0057) | **DIES** — 30.5% F retained, p = 0.56 |
| semi IP deseasonalized (PIT) → PAYEMS | 533 | LEADS at 2m (p = 0.0037) | **DIES** — 70.7% F retained, p = 0.11 |

And the placebo that settles it: **total industrial production → PAYEMS leads at
1 month with p = 1.7e-20.** Generic output leads employment overwhelmingly,
because employment is a lagging indicator. "Semiconductor output leads
employment" was never a statement about semiconductors.

## 9. What v2 passes, kept and stated

Worth leading with, because it is genuinely uncommon:

1. **Reverse-direction testing** — v2 already reports GDP → R (F = 2.14,
   p = 0.121). Most lead-lag claims never run it.
2. **F-dominance** — 5.83 / 2.14 = **2.72**, above the 2.0 threshold. Report the
   ratio; it is a stronger and more honest statement than "the reverse was
   insignificant", and it is immune to the underflow problem that produced the
   ag study's third false positive.
3. **Lag-order robustness** across `p ∈ {1,2,3,4}` and Toda–Yamamoto.
4. **Having a placebo at all** — the ag study had none. The specific placebo
   needs replacing (§5), not the practice.

**Not verifiable from this repository:** the v2 Granger result itself. The
paper's Availability section promises "Granger causality estimation code (Stata
and Python)" at this repo; `scripts/` contains one unrelated `.mjs` file, and
the quarterly ASP series the VAR runs on is not here. The headline number cannot
currently be reproduced by a reader. That is now fixable — the harness exists;
it needs the data.

## 10. Sample size on the bifurcated index

`ram_commodity_R`, `ram_ai_R` and `hbm_weight` are populated for **three rows**:
2024, 2025, 2026 — one of which is the forecast row. No inferential statistic is
estimable; the harness floor alone requires 5 observations for a single-lag test.

The honest label is **UNTESTABLE** — an absence of a test, not a null. The ag
study retired its Bos indicus track on exactly this basis rather than reporting
a rejection. v3 should either build the sub-indices quarterly (n ≈ 12, still
marginal) or present the bifurcation as a descriptive regime claim with no
inferential statistics attached, and make sure the composite's Granger result
cannot be read as covering the sub-indices.

## 11. The theoretical payoff

The most useful non-statistical output of the ag work is a **mechanism with a
boundary**:

> DRAM leads because memory is bought by a few hundred capacity-planning firms
> ahead of deploying compute, so the purchase *is* a forward expectation
> expressed as a price. Agricultural inputs are bought by ~2M atomized
> price-takers on an agronomic calendar, funded by last season's cash — no agent
> expresses a forward expectation as a price, so the failure is structural.

That converts RI from "DRAM happens to work" into a **class of indicator with a
testable scope condition**: concentrated buyers + discretionary forward
commitment + fast, elastic, private-market price. Agriculture becomes a
tested-and-failed boundary case rather than an unexamined gap. Farm machinery —
financed capex, the closest structural analogue to DRAM — leads nothing either,
which sharpens the condition to *concentration* rather than merely *capex*.

The §5 and §8 results sharpen it further, at v2's expense: neither the broad
semiconductor price complex nor semiconductor output satisfies it. Whatever the
RI is measuring, it is narrower than "semiconductors", and v3 has to say so.

This is the strongest thing to import, and it costs no new data.

## 11a. RI-M: the monthly index, built and rejected

Run output: [`analysis/out/FACTS-RIM.txt`](analysis/out/FACTS-RIM.txt).
Code: [`ri_leadtest/mccallum.py`](analysis/ri_leadtest/mccallum.py),
[`ri_leadtest/index_v3.py`](analysis/ri_leadtest/index_v3.py),
[`battery_v3.py`](analysis/battery_v3.py).

**The archive is recovered.** jcmit.net lapsed and the McCallum workbook is gone
from the live web. It was retrieved from the Internet Archive — OLE metadata
reads *Author: John McCallum, created 1998-11-09, last saved 2020-09-20* — and
is cached at `analysis/data/mccallum_MemDiskPrice-xl95_20200920.xls`. 380 dated
observations; 342 monthly $/MB values from 1985-01 to 2020-09.

**RI-M was built from it and it works as a construction.** 278 adjacent-month
log returns, point-in-time by proof (`assert_point_in_time`: 193 overlapping
months, max abs difference 0.0 when the archive is truncated and the index
rebuilt), gap-aware (63 gaps totalling 150 months emit no return rather than a
fabricated zero), vintage-stamped. It is everything v2's construction is not.

**And it is not a usable index.** Guard 6 and Guard 7 both fire:

| Check | Result |
|---|---|
| Staleness | 21.6% of months unchanged; longest flat run 10 months |
| vs IR213 import price index, monthly | r = **0.133** |
| vs IQ213 export price index, monthly | r = **0.029** |
| vs semiconductor PPI, monthly | r = **0.120** |

The archive is a sequence of *individual advertised retail quotes* — BYTE and
JDR magazine ads, later NewEgg listings — not a survey. The same quote is
carried for months (`$504.833` runs from 1988-07 to 1989-04), and successive
observations often switch to a different module. At annual frequency the noise
averages out and it tracks everything at 0.45–0.60. At monthly frequency, which
is the entire point, it agrees with nothing.

So RI-M's null is uninformative in exactly the sense Guard 6 was written for:

```
RI-M -> INDPRO  (n=278)  p = 0.622    F ratio 1.26
RI-M -> PAYEMS  (n=278)  p = 0.450    F ratio 17.54
RI-M -> real GDP (n=73)  p = 0.497    F ratio 1.82
```

Those are not marginal misses. Peak lead correlation is 0.122 and every one dies
under Guard 5. But the instrument cannot support a rejection, so **the honest
verdict is UNTESTABLE, not NO LEAD** — the same call the ag study made on
cartel-administered potash prices, and for the same structural reason.

**The conclusion this forces.** The monthly Ramification Index cannot be built
from public or recoverable sources. That is now established from two independent
directions: no public *index* measures DRAM (§3, r = 0.186), and the one genuine
*archive* of DRAM prices is too sparse and too stale to difference monthly. The
binding constraint in §12 is confirmed, not relieved.

## 11b. Two data-integrity findings in the published series

**The provenance in v2's README is wrong.** v1 documents the series
(`memory-index/research/ram-prices.md` §2) as "mid-year average retail for a
typical mainstream module, **rounded**", blended from McCallum, hblok.net *and*
TrendForce. v2's README describes it as "McCallum archive (1980–2017)
chain-linked to TrendForce DDR4 contract ASP (2018–2026)". It is a rounded
three-source blend, and v1 says so; v2 overstates it. This explains the r = 0.597
against the archive — that number is not evidence of an error, and I withdraw
the stronger reading of it.

**The 1988 RAM drought is missing from the index.** This one is not a
documentation issue.

| Year | Published $/MB | Published YoY | Archive $/MB | Archive YoY |
|---|---|---|---|---|
| 1987 | 133 | −29.1% | 158 | −37.2% |
| **1988** | **107** | **−21.8%** | **361** | **+82.5%** |
| 1989 | 73 | −38.2% | 300 | −18.6% |

v1's own §3 event table records 1988 as *"The Year of the RAM Drought … Prices
spiked ~60% YoY"*, and the monthly archive shows it plainly: $153/MB through
mid-1987, $199 by March 1988, $505 from July 1988. The published price table
shows a monotone decline straight through. **v1 §2 contradicts v1 §3 for that
year**, and v2 inherits the price table unchanged.

This matters past 1988. v2's central new claim is RAMageddon — a supply-side
divergence regime argued to be "without historical precedent" in the 46-year
series. The nearest historical precedent is a post-dumping capacity-underinvestment
shortage that the series does not contain. The uniqueness claim cannot be
evaluated until 1988 is right.

Also: comparing v1's and v2's panels, **only the 2026 row changed** — by +86.9%
($0.0052 → $0.0097/MB). Every other year is byte-identical. The forecast row is
live and moving between versions, which is the §6 point with a number attached.

## 12. What v3 needs, in order

1. **Acquire a monthly DRAM ASP series.** This is the binding constraint on
   everything else — §2 shows the power gain, §3 shows no public substitute
   works. TrendForce or Counterpoint contract+spot monthly, back as far as the
   licence allows. Everything downstream is built and waiting.
2. **Re-run the battery on it.** `analysis/battery.py` needs one new series and
   a section; the guards, tests and output format already exist.
3. **Publish the estimation code and the ASP series** (or a licensed derivative)
   so the headline Granger result is reproducible. Currently it is not.
4. **Correlate the vendors' ASP series against each other**, not just their
   correlations with GDP. That is Guard 7; §3 shows it is not a formality.
5. **Run Guard 5 on the actual v2 quarterly specification.** It passes on the
   annual panel at 98.9% F retained, which is a real and reportable result.
6. **Audit `hbm_weight` and the 2018 chain-link** for point-in-time
   construction. Not checkable from published data.
7. **Add a vintage column** to `indices-wide.csv` and mark 2026 provisional.
8. **Replace the NAND placebo** with one that fails the mechanism — passive
   components work, and are in the battery already.
9. **Downgrade the bifurcated index to descriptive**, or rebuild it quarterly.
10. **Write the scope condition into the theory section.**

Guards 1–3 v2 already passes, and leading with that is fair — provided 4–8 are
run rather than asserted.

---

### Files

| | |
|---|---|
| [`analysis/ri_leadtest/leadtest.py`](analysis/ri_leadtest/leadtest.py) | The harness. 8 guards, frequency-aware |
| [`analysis/ri_leadtest/data.py`](analysis/ri_leadtest/data.py) | Keyless FRED fetchers, cached to `analysis/data/` |
| [`analysis/battery.py`](analysis/battery.py) | Every guard, every frequency |
| [`analysis/out/FACTS.txt`](analysis/out/FACTS.txt) | Verbatim run output. Every figure above traces here |
| [`analysis/tests/`](analysis/tests) | 20 regression tests pinning the guards |
