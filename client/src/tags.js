// Tag words (server/tags.js normalizes them the same way) and the existing tags a new word is close to,
// offered before creating it ("tarris" → tariffs; "taxes" → taxation).

export const normalizeWord = word =>
  (word ?? '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');

function editDistance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return row[b.length];
}

const commonPrefix = (a, b) => {
  let n = 0;
  while (n < a.length && a[n] === b[n]) n++;
  return n;
};

// Existing words close to `word`: a typo or two apart, the same stem (3+ letters), or one inside the other.
export function nearMatches(word, words) {
  if (word.length < 3) return [];
  return words.filter(w => w !== word && (
    editDistance(w, word) <= 2 || commonPrefix(w, word) >= 3 || w.includes(word) || word.includes(w)
  ));
}
