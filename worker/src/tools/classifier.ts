/**
 * RAM Index Feed Classifier
 *
 * Deterministic tag assignment for feed items. Priority order matters —
 * first match wins so more specific classes beat the default SUPPLY catch-all.
 *
 * Tags: FAB | EARNINGS | MACRO | DEMAND | SUPPLY
 * PICK is an editorial overlay, not a class — handled separately.
 */

export type FeedTag = 'fab' | 'earnings' | 'macro' | 'demand' | 'supply';

interface Rule {
  tag: FeedTag;
  patterns: RegExp[];
}

// Ordered highest-priority → lowest. Each rule fires on the first pattern match.
const RULES: Rule[] = [
  {
    tag: 'fab',
    patterns: [
      /\b(wafer|fab(rication)?|yield|nm[ -]?node|\d+nm|\d+a[ -]?node|foundry|tsmc|imec|cleanroom|lithograph|euv|duvr?|ramp.{0,20}(produc|capac)|new.{0,20}(plant|facility)|pyeongtaek|hiroshima|boise|fab\d+|p\d+\s+fab)\b/i,
      /\b(capacity.{0,30}delay|delay.{0,30}(ramp|produc)|mass.{0,15}produc|process.{0,20}node|1[abc]-nm|1[abc]nm)\b/i,
    ],
  },
  {
    tag: 'earnings',
    patterns: [
      /\b(earnings?|quarterly\s+results?|q[1-4]\s+20\d\d|fy20\d\d|guidance|revenue|operating\s+(margin|income|profit)|net\s+(income|profit|loss)|eps|beat|miss(ed)?.{0,15}(estimate|consensus)|margin\s+expand|margin\s+compress)\b/i,
      /\b(annual\s+report|full.year\s+results?|preliminary\s+results?|profit\s+warning|earnings\s+call|investor\s+day)\b/i,
    ],
  },
  {
    tag: 'macro',
    patterns: [
      /\b(gdp|gross\s+domestic|recession|inflation|cpi|ppi|fomc|federal\s+(reserve|funds)|interest\s+rate|tariff|trade\s+(war|policy|deal|deficit)|sanctions|export\s+(control|ban|restrict)|import\s+(duty|tariff)|macro(economic)?|stagflat|unemployment|job(s)?\s+report|nonfarm|ism\s+manufactur)\b/i,
      /\b(bea\s+revise|advance\s+(gdp|estimate)|flash\s+(gdp|pmi)|consensus\s+forecast|central\s+bank|rate\s+(hike|cut|pause)|quantitative)\b/i,
    ],
  },
  {
    tag: 'demand',
    patterns: [
      /\b(hbm|high.bandwidth.memory|ai\s+(memory|chip|server|infra|demand|workload)|gpu\s+(demand|supply|shortage)|data\s+cent(er|re)|hyperscal|inference|training\s+(cluster|demand)|blackwell|hopper|gb\d{3}|nvl\d+|rack.{0,20}(demand|deploy)|allocation.{0,20}lock|memory.{0,20}(ai|bandwidth))\b/i,
      /\b(nvidia|amd.{0,20}(mi\d+|instinct)|intel.{0,20}gaudi|tpu|xpu|accelerat.{0,20}(demand|adopt)|cloud.{0,20}(capex|spend|invest))\b/i,
    ],
  },
  {
    tag: 'supply',  // catch-all — always matches
    patterns: [/.*/],
  },
];

export function classifyItem(title: string, excerpt: string): FeedTag {
  const haystack = `${title} ${excerpt}`.toLowerCase();
  for (const rule of RULES) {
    if (rule.patterns.some(p => p.test(haystack))) {
      return rule.tag;
    }
  }
  return 'supply';
}
