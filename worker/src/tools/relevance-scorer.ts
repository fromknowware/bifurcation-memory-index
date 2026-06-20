/**
 * Relevance Scorer — Claude haiku filters candidates for RAM Index signal
 *
 * Scores each item 0–10 on two axes:
 *   signal   — does this move the Ramification Index thesis?
 *   novelty  — not a duplicate of something already in the feed
 *
 * Items with signal < 6 are dropped. Editorial picks (Raindrop) skip scoring.
 */

import type { FeedItem } from './opml-source';
import { classifyItem, FeedTag } from './classifier';

export interface ScoredItem extends FeedItem {
  signal: number;
  reasoning: string;
  riImplication: string;
  tag: FeedTag;
  editorialPick?: boolean;
}

function buildSystemPrompt(thesis: string) {
  return `You are the editorial filter for The RAM Index — a macroeconomic research publication that tracks DRAM average selling prices (ASP) as a leading indicator of global GDP.

Current thesis under investigation:
"${thesis}"

Score each article on how strongly it CONFIRMS, CHALLENGES, or is IRRELEVANT to this thesis (0–10):
- 9–10: Direct evidence — DRAM/HBM ASP data, supply-demand shocks, earnings guidance from Micron/Samsung/SK Hynix
- 7–8:  Strong signal — semiconductor tariffs, capacity announcements, AI infrastructure demand shifts
- 5–6:  Weak signal — broader macro data, DDR5 adoption, trade policy with memory implications
- 3–4:  Tangential — general tech/macro that might weakly affect the thesis
- 0–2:  Noise — unrelated, clickbait, or no memory-market angle

Respond with JSON only. No markdown. No explanation outside the JSON.`;
}

interface ScoreResult {
  signal: number;
  reasoning: string;
  ri_implication: string;
}

export async function scoreItems(
  items: FeedItem[],
  anthropicApiKey: string,
  thesis?: string,
  implicitOnly = false,
): Promise<ScoredItem[]> {
  if (items.length === 0) return [];

  // Batch in groups of 10 to stay within token limits
  const batches: FeedItem[][] = [];
  for (let i = 0; i < items.length; i += 10) {
    batches.push(items.slice(i, i + 10));
  }

  const scored: ScoredItem[] = [];

  for (const batch of batches) {
    const prompt = `Score each article for RAM Index signal relevance. Return a JSON array with one object per article in the same order:
[{"signal": <0-10>, "reasoning": "<one sentence on why this matters>", "ri_implication": "<one sentence starting with a verb — what this means for R_C, R_AI, composite RI, or the bifurcation thesis>"}, ...]

Articles:
${batch.map((item, i) => `${i + 1}. "${item.title}" — ${item.excerpt.slice(0, 150)}`).join('\n')}`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1024,
          system: buildSystemPrompt(thesis ?? 'DRAM ASP as a leading GDP indicator; bifurcation between commodity DRAM and HBM'),
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(25000),
      });

      if (!res.ok) {
        console.error('Anthropic error:', res.status);
        continue;
      }

      const data = await res.json() as { content: { text: string }[] };
      let text = data.content[0]?.text ?? '[]';
      // Strip markdown code fences if present
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const scores = JSON.parse(text) as ScoreResult[];

      for (let i = 0; i < batch.length; i++) {
        const score = scores[i];
        if (!score) continue;
        scored.push({
          ...batch[i],
          signal: score.signal ?? 5,
          reasoning: score.reasoning ?? '',
          riImplication: score.ri_implication ?? '',
          tag: classifyItem(batch[i].title, batch[i].excerpt),
        });
      }
    } catch (err) {
      console.error('scoreItems batch failed:', String(err));
    }
  }

  // Keep signal >= 6 unless implicitOnly (editorial picks — always publish, just need the RI implication)
  return implicitOnly ? scored : scored.filter((item) => item.signal >= 6);
}

// Convenience wrapper for editorial picks: scores for RI implication only, no signal gate
export async function annotateItems(
  items: FeedItem[],
  anthropicApiKey: string,
  thesis?: string,
): Promise<ScoredItem[]> {
  return scoreItems(items, anthropicApiKey, thesis, true);
}
