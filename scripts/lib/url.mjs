/**
 * url.mjs — shared URL hygiene used by the feed renderer and the story
 * builder so slug hashing always sees the same normalized URL.
 */

const TRACKING_PARAMS = new Set([
  'guccounter', 'guce_referrer', 'guce_referrer_sig',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref', 'src',
]);

/** Decode repeated &amp;-style escaping, then strip tracking params. */
export function cleanUrl(raw) {
  if (!raw) return '';
  let url = raw.trim();
  // Decode repeated &amp;-nesting to fixpoint (old pipeline double-escaped
  // URLs across commits; cap guards against pathological input).
  let guard = 0;
  while (url.includes('&amp;') && guard++ < 20) {
    url = url.replace(/&amp;/g, '&');
  }
  try {
    const u = new URL(url);
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key)) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return url;
  }
}
