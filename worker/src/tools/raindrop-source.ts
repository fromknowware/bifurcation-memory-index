/**
 * Raindrop.io Source — editorial curation layer
 *
 * Items you manually bookmark to your "RAM Index" Raindrop collection
 * bypass relevance scoring (score = 10) and go straight into the feed.
 * Wire in RAINDROP_API_TOKEN + RAINDROP_COLLECTION_ID env vars to activate.
 *
 * Collection ID: share this once you've created the RAM Index folder.
 */

import type { FeedItem } from './opml-source';

interface RaindropItem {
  _id: number;
  title: string;
  link: string;
  excerpt: string;
  domain: string;
  created: string;
  tags: string[];
}

interface RaindropResponse {
  items: RaindropItem[];
  count: number;
}

export async function fetchFromRaindrop(
  apiToken: string,
  collectionId: string,
  sinceIso?: string | null,
): Promise<(FeedItem & { editorialPick: true })[]> {
  if (!apiToken || !collectionId) return [];

  // Always fetch all — dossier handles dedup. Raindrop's `created` field is
  // when a bookmark was first saved to the account, not when it entered this
  // collection, so time-filtering misses items moved from other folders.
  const url = `https://api.raindrop.io/rest/v1/raindrops/${collectionId}?` +
    new URLSearchParams({ sort: '-created', perpage: '50' });

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Raindrop API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as RaindropResponse;

  return data.items.map((item) => ({
    id: String(item._id),
    title: item.title,
    url: item.link,
    excerpt: item.excerpt || '',
    source: item.domain || 'Raindrop',
    sourceFeed: 'raindrop',
    publishedAt: item.created,
    editorialPick: true as const,
    tags: item.tags,
  }));
}
