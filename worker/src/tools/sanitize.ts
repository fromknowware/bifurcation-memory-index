/**
 * Text sanitizer for feed content.
 *
 * Guards against:
 *   - Double-encoded UTF-8 (Ã  sequences from Latin-1 misread of UTF-8 bytes)
 *   - Repeated encoding artifacts (ÃÂÃÂ... runs)
 *   - Runaway-length titles/excerpts from corrupted data
 *   - Null bytes and C0/C1 control characters
 */

// Max character lengths for stored fields
const MAX_TITLE   = 300;
const MAX_EXCERPT = 1200;

// Heuristic: if a string has more than 5% Ã or  characters it's been double-encoded
const CORRUPTION_THRESHOLD = 0.05;

function isCorrupted(text: string): boolean {
  if (!text) return false;
  const garbage = (text.match(/[ÃÂ]/g) ?? []).length;
  return text.length > 20 && garbage / text.length > CORRUPTION_THRESHOLD;
}

function tryFixDoubleEncoded(text: string): string {
  try {
    // Re-encode as Latin-1 byte values, then decode as UTF-8
    const bytes = Uint8Array.from(text, c => c.charCodeAt(0));
    const decoded = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
    return decoded;
  } catch {
    return text;
  }
}

function stripControls(text: string): string {
  // Remove null bytes and ASCII control chars except tab/newline
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

export function sanitizeTitle(text: string): string {
  let s = stripControls(text ?? '');
  if (isCorrupted(s)) {
    const fixed = tryFixDoubleEncoded(s);
    s = isCorrupted(fixed) ? s.replace(/[ÃÂ�]/g, '').replace(/\s{2,}/g, ' ').trim() : fixed;
  }
  return s.slice(0, MAX_TITLE).trim();
}

export function sanitizeExcerpt(text: string): string {
  let s = stripControls(text ?? '');
  if (isCorrupted(s)) {
    const fixed = tryFixDoubleEncoded(s);
    s = isCorrupted(fixed) ? s.replace(/[ÃÂ�]/g, '').replace(/\s{2,}/g, ' ').trim() : fixed;
  }
  return s.slice(0, MAX_EXCERPT).trim();
}

export function isItemCorrupted(title: string, excerpt: string): boolean {
  // An item is unsalvageably corrupted if title is too long or still garbage after sanitize
  if (title.length > MAX_TITLE * 3) return true;
  const cleaned = sanitizeTitle(title);
  return isCorrupted(cleaned);
}
