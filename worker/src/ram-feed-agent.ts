/**
 * RamFeedAgent — Durable Object for The RAM Index content feed
 *
 * Curates memory-market news against a live thesis. Tracks what it's already
 * surfaced (dossier) so each run surfaces only fresh confirming evidence.
 *
 * Schedules:
 *   Every 6h  → Google News sweep against current thesis
 *   Daily 9am → Raindrop dropbox check (new additions since last check)
 *   Daily 2am → OPML full sweep
 *
 * HTTP endpoints:
 *   PUT  /ram-feed/thesis       — set current thesis narrative
 *   GET  /ram-feed/status       — agent state + dossier stats
 *   POST /ram-feed/run          — manual trigger { full?: boolean }
 *   PUT  /ram-feed/opml         — upload Feedly OPML export
 *
 * Env vars:
 *   ANTHROPIC_API_KEY        — claude-3-5-haiku for scoring
 *   GITHUB_TOKEN             — commit feed.xml to bifurcation-memory-index
 *   RAINDROP_API_TOKEN       — Raindrop OAuth token
 *   RAINDROP_COLLECTION_ID   — 71684447 (theusual / The RAM Index dropbox)
 */

import { Agent, unstable_callable as callable } from 'agents';
import type { Env } from './types';
import { fetchFromOpml } from './tools/opml-source';
import { fetchFromGoogleNews } from './tools/google-news-source';
import { fetchFromRaindrop } from './tools/raindrop-source';
import { scoreItems, annotateItems } from './tools/relevance-scorer';
import { fetchExistingItems, renderAtom, commitFeed, StoredItem, writeFeed } from './tools/feed-writer';
import { classifyItem } from './tools/classifier';

interface RamFeedState {
  // Thesis the agent is currently confirming
  thesis: string;
  thesisSetAt: string | null;

  // Dossier: URLs already surfaced — prevents re-surfacing known stories
  dossier: string[];

  // Timestamps for incremental Raindrop polling
  lastRaindropCheck: string | null;

  // Run metadata
  lastQuickRun: string | null;
  lastFullRun: string | null;
  lastRaindropRun: string | null;
  totalItemsPublished: number;
  lastRunErrors: string[];
}

const DEFAULT_THESIS =
  'HBM capacity conversion is diverting commodity DRAM supply, driving a spot-price super-spike that historically precedes GDP deceleration. Bifurcation between AI memory and commodity memory is widening.';

export class RamFeedAgent extends Agent<Env, RamFeedState> {

  initialState: RamFeedState = {
    thesis: DEFAULT_THESIS,
    thesisSetAt: null,
    dossier: [],
    lastRaindropCheck: null,
    lastQuickRun: null,
    lastFullRun: null,
    lastRaindropRun: null,
    totalItemsPublished: 0,
    lastRunErrors: [],
  };

  async onStart() {
    this.schedule('0 */6 * * *', 'newsRun');      // Google News every 6h
    this.schedule('0 9 * * *',   'raindropCheck'); // Raindrop daily at 9am
    this.schedule('0 2 * * *',   'fullRun');       // OPML sweep daily at 2am
  }

  // ─── Helpers ───────────────────────────────────────────────────

  private dedup<T extends { url: string }>(items: T[]): T[] {
    const seen = new Set(this.state.dossier);
    return items.filter((item) => !seen.has(item.url));
  }

  private addToDossier(urls: string[]) {
    const next = [...new Set([...this.state.dossier, ...urls])];
    // Cap dossier at 2000 entries (oldest fall off)
    this.setState({ ...this.state, dossier: next.slice(-2000) });
  }

  // ─── Scheduled: Google News against current thesis ─────────────

  @callable()
  async newsRun(): Promise<{ committed: number; total: number }> {
    const errors: string[] = [];

    let items: Awaited<ReturnType<typeof fetchFromGoogleNews>> = [];
    try {
      items = await fetchFromGoogleNews();
    } catch (e) {
      errors.push(`google-news: ${String(e)}`);
    }

    const fresh = this.dedup(items);
    const scored = await scoreItems(fresh, this.env.ANTHROPIC_API_KEY, this.state.thesis);

    const result = await writeFeed(scored, this.env.GITHUB_TOKEN, 'fromknowware', 'bifurcation-memory-index');

    this.addToDossier(scored.map((i) => i.url));
    this.setState({
      ...this.state,
      lastQuickRun: new Date().toISOString(),
      totalItemsPublished: this.state.totalItemsPublished + result.committed,
      lastRunErrors: errors,
    });

    return result;
  }

  // ─── Scheduled: Daily Raindrop dropbox check ───────────────────

  @callable()
  async raindropCheck(): Promise<{ committed: number; total: number }> {
    const errors: string[] = [];
    const token = this.env.RAINDROP_API_TOKEN ?? '';
    const collectionId = this.env.RAINDROP_COLLECTION_ID ?? '71684447';

    if (!token) {
      return { committed: 0, total: 0 };
    }

    let items: Awaited<ReturnType<typeof fetchFromRaindrop>> = [];
    try {
      // Poll only since last successful check (incremental)
      items = await fetchFromRaindrop(token, collectionId, this.state.lastRaindropCheck);
    } catch (e) {
      errors.push(`raindrop: ${String(e)}`);
    }

    // Editorial picks bypass signal gating but still get an RI implication via annotateItems.
    // Falls back to classify-only if the API is unavailable (credits exhausted etc.).
    // No dossier dedup here: writeFeed deduplicates against the live feed.xml.
    const annotated = await annotateItems(items, this.env.ANTHROPIC_API_KEY, this.state.thesis);
    const annotatedUrls = new Set(annotated.map(i => i.url));
    const editorialReady = [
      // Items Claude annotated — carry ri_implication + tag
      ...annotated.map(item => ({ ...item, signal: 10, editorialPick: true })),
      // Items Claude missed (API down) — classify locally, publish without RI implication
      ...items
        .filter(item => !annotatedUrls.has(item.url))
        .map(item => ({
          ...item,
          signal: 10,
          reasoning: 'Editorial pick',
          riImplication: '',
          tag: classifyItem(item.title, item.excerpt),
          editorialPick: true,
        })),
    ];

    const result = await writeFeed(editorialReady, this.env.GITHUB_TOKEN, 'fromknowware', 'bifurcation-memory-index');
    this.setState({
      ...this.state,
      lastRaindropCheck: new Date().toISOString(),
      lastRaindropRun: new Date().toISOString(),
      totalItemsPublished: this.state.totalItemsPublished + result.committed,
      lastRunErrors: errors,
    });

    return result;
  }

  // ─── Scheduled: Full OPML sweep ────────────────────────────────

  @callable()
  async fullRun(): Promise<{ committed: number; total: number }> {
    const errors: string[] = [];

    let opmlItems: Awaited<ReturnType<typeof fetchFromOpml>> = [];
    try {
      opmlItems = await fetchFromOpml(this.env.CONFIG, 24);
    } catch (e) {
      errors.push(`opml: ${String(e)}`);
    }

    const fresh = this.dedup(opmlItems);
    const scored = await scoreItems(fresh, this.env.ANTHROPIC_API_KEY, this.state.thesis);
    const result = await writeFeed(scored, this.env.GITHUB_TOKEN, 'fromknowware', 'bifurcation-memory-index');

    this.addToDossier(scored.map((i) => i.url));

    // Also run news and Raindrop so nothing is missed
    const newsResult = await this.newsRun();
    const raindropResult = await this.raindropCheck();

    this.setState({
      ...this.state,
      lastFullRun: new Date().toISOString(),
      totalItemsPublished: this.state.totalItemsPublished + result.committed,
      lastRunErrors: errors,
    });

    return {
      committed: result.committed + newsResult.committed + raindropResult.committed,
      total: result.total,
    };
  }

  // ─── HTTP ──────────────────────────────────────────────────────

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // PUT /ram-feed/thesis — update the thesis the agent is confirming
    if (path === '/ram-feed/thesis' && request.method === 'PUT') {
      const body = await request.json() as { thesis: string };
      if (!body.thesis?.trim()) {
        return new Response('Missing thesis', { status: 400 });
      }
      this.setState({
        ...this.state,
        thesis: body.thesis.trim(),
        thesisSetAt: new Date().toISOString(),
      });
      return Response.json({ ok: true, thesis: this.state.thesis });
    }

    // GET /ram-feed/status
    if (path === '/ram-feed/status' && request.method === 'GET') {
      return Response.json({
        ...this.state,
        dossierSize: this.state.dossier.length,
        dossier: undefined, // omit the full list from status
      });
    }

    // POST /ram-feed/run — manual trigger
    // body: { full?, raindrop?, since? } — since resets the Raindrop lookback window (ISO string or "all")
    if (path === '/ram-feed/run' && request.method === 'POST') {
      const body = await request.json() as { full?: boolean; raindrop?: boolean; since?: string };
      if (body.since) {
        const ts = body.since === 'all' ? null : body.since;
        this.setState({ ...this.state, lastRaindropCheck: ts });
      }
      let result;
      if (body.full)           result = await this.fullRun();
      else if (body.raindrop)  result = await this.raindropCheck();
      else                     result = await this.newsRun();
      return Response.json(result);
    }

    // POST /ram-feed/reimply — backfill RI implications on existing feed items
    // body: { limit?: number } — default 10 items per call; run repeatedly until remaining === 0
    if (path === '/ram-feed/reimply' && request.method === 'POST') {
      const body = await request.json().catch(() => ({})) as { limit?: number };
      const limit = Math.min(body.limit ?? 10, 20);
      const existing = await fetchExistingItems(this.env.GITHUB_TOKEN, 'fromknowware', 'bifurcation-memory-index');
      const needsImplication = existing.filter(item => !item.riImplication).slice(0, limit);
      if (needsImplication.length === 0) {
        return Response.json({ ok: true, updated: 0, remaining: 0, message: 'All items have RI implications' });
      }
      const asFeedItems = needsImplication.map(item => ({
        id: item.url,
        url: item.url,
        title: item.title,
        excerpt: item.excerpt,
        source: item.source,
        sourceFeed: item.sourceFeed,
        publishedAt: item.publishedAt,
      }));
      const scored = await annotateItems(asFeedItems, this.env.ANTHROPIC_API_KEY, this.state.thesis);
      const implMap = new Map(scored.map(s => [s.url, { ri: s.riImplication, tag: s.tag }]));
      const updated = existing.map(item => ({
        ...item,
        tag: item.tag || implMap.get(item.url)?.tag || classifyItem(item.title, item.excerpt),
        riImplication: item.riImplication || implMap.get(item.url)?.ri || '',
      }));
      const xml = renderAtom(updated);
      await commitFeed(xml, this.env.GITHUB_TOKEN, 'fromknowware', 'bifurcation-memory-index');
      const remaining = existing.filter(item => !item.riImplication).length - scored.length;
      return Response.json({ ok: true, updated: scored.length, remaining: Math.max(0, remaining), total: existing.length });
    }

    // PUT /ram-feed/opml
    if (path === '/ram-feed/opml' && request.method === 'PUT') {
      const opml = await request.text();
      if (!opml.includes('<opml') && !opml.includes('<outline')) {
        return new Response('Not valid OPML', { status: 400 });
      }
      await this.env.CONFIG.put('ram_feed:opml', opml);
      return Response.json({ ok: true, message: 'OPML stored. Next fullRun will use it.' });
    }

    // GET /ram-feed/debug — surface env + raw Raindrop response
    if (path === '/ram-feed/debug' && request.method === 'GET') {
      const token = this.env.RAINDROP_API_TOKEN ?? '';
      const collectionId = this.env.RAINDROP_COLLECTION_ID ?? '71684447';
      const hasToken = token.length > 0;
      let raindropStatus = 0;
      let raindropBody = '';
      if (hasToken) {
        try {
          const res = await fetch(
            `https://api.raindrop.io/rest/v1/raindrops/${collectionId}?sort=-created&perpage=5`,
            { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) },
          );
          raindropStatus = res.status;
          raindropBody = await res.text();
        } catch (e) {
          raindropBody = String(e);
        }
      }
      return Response.json({
        hasToken,
        tokenPrefix: hasToken ? token.slice(0, 8) + '...' : null,
        collectionId,
        raindropStatus,
        raindropItemCount: raindropBody.includes('"count"') ? JSON.parse(raindropBody).count : null,
        raindropError: raindropStatus !== 200 ? raindropBody.slice(0, 300) : null,
      });
    }

    return new Response('Not found', { status: 404 });
  }
}
