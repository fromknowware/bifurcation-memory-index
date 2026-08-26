/**
 * slug.mjs — shared story-slug + URL helpers.
 *
 * Used by both feed-update.mjs (which stamps each feed entry with its story
 * page link) and build-stories.mjs (which generates the pages), so the two
 * can never disagree.
 *
 * Slug = slugified title + short stable hash of the URL. The hash guarantees
 * uniqueness across runs even when two items share a title, without needing
 * collision bookkeeping.
 */

export function slugifyTitle(title) {
  const base = String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&amp;/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return (base.slice(0, 52) || 'story').replace(/-+$/, '');
}

/** Small deterministic string hash (FNV-1a), hex-encoded, 8 chars. */
export function shortHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 8);
}

import { cleanUrl } from './url.mjs';

export function storySlug(item) {
  return `${slugifyTitle(item.title)}-${shortHash(cleanUrl(item.url || ''))}`;
}

export function storyUrl(item) {
  return `/stories/${storySlug(item)}.html`;
}
