/**
 * How much of two texts is the same: the share of five-word runs they have in common
 * (Jaccard similarity of word 5-shingles), from 0 (nothing) to 1 (the same words in the same
 * order). Case and punctuation are ignored. Rewording a sentence lowers it; reordering whole
 * sections barely does. Used by seed/match-bill-texts.js to find House and Senate bills that
 * are one proposal although Congress.gov does not mark them identical.
 */

const SHINGLE = 5;

export function words(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);
}

export function shingles(wordList) {
  const set = new Set();
  for (let i = 0; i + SHINGLE <= wordList.length; i++) set.add(wordList.slice(i, i + SHINGLE).join(' '));
  return set;
}

// FNV-1a, 32 bits: a compact stand-in for a shingle, so thousands of bills fit in memory.
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** A text's shingles as sorted, distinct 32-bit hashes. */
export function shingleHashes(wordList) {
  const all = new Uint32Array(Math.max(0, wordList.length - SHINGLE + 1));
  for (let i = 0; i < all.length; i++) all[i] = hash(wordList.slice(i, i + SHINGLE).join(' '));
  all.sort();
  let n = 0;
  for (let i = 0; i < all.length; i++) if (i === 0 || all[i] !== all[i - 1]) all[n++] = all[i];
  return all.slice(0, n);
}

/** Similarity of two shingleHashes arrays; null when either is empty. */
export function hashSimilarity(a, b) {
  if (!a.length || !b.length) return null;
  let i = 0, j = 0, shared = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { shared++; i++; j++; } else if (a[i] < b[j]) i++; else j++;
  }
  return shared / (a.length + b.length - shared);
}

/** Similarity of two shingle sets; null when either is empty (no text to compare). */
export function similarity(a, b) {
  if (!a.size || !b.size) return null;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const s of small) if (large.has(s)) shared++;
  return shared / (a.size + b.size - shared);
}
