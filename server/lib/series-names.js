// Checks on economic series names (design/timeline-data/NAMING.md). A series' `name` is the one name
// readers see everywhere: search, the timeline's lanes and legends, the Economy page, the cursor card.
// load-economic-series.js refuses to store names that break these rules; what can't be checked by
// machine (the reader's words, saying the frequency only when it tells two series apart) is for review.

// Short words kept lower case inside a name.
const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'per', 'the', 'to', 'with']);
export const MAX_NAME = 80; // 60 until 2026-10-15, raised for the national accounts (user)

/** What is wrong with one name, as sentences; empty when it is fine. */
export function nameProblems(name) {
  const problems = [];
  if (!name || !name.trim()) return ['is empty'];
  if (name.length > MAX_NAME) problems.push(`is ${name.length} characters (at most ${MAX_NAME})`);
  if (name !== name.trim() || /\s{2}/.test(name)) problems.push('has stray spaces');
  if (/[.,;:]$/.test(name)) problems.push('ends in punctuation');
  if (/'/.test(name)) problems.push('uses a straight apostrophe (’ is the one used in names)');
  if (/\((daily|weekly|monthly|yearly|quarterly)\b/i.test(name)) problems.push('says how often in parentheses (it goes in front: “Monthly …”)');
  name.split(' ').forEach((raw, i) => {
    const word = raw.replace(/^[(“]+/, '').replace(/[),”’]+$/, '');
    if (!/^[A-Za-z]/.test(word)) return; // "30-Year", "16–19", "U.S." are fine as written
    const lower = word.toLowerCase();
    if (i > 0 && SMALL.has(lower)) {
      if (word !== lower) problems.push(`“${word}” should be lower case`);
    } else if (/^[a-z]/.test(word)) {
      problems.push(`“${word}” should start with a capital (Title Case)`);
    }
  });
  return problems;
}

/** Problems across a list of series: each name's own, and names used twice. */
export function seriesNameProblems(series) {
  const out = [];
  const seen = new Map();
  for (const s of series) {
    for (const p of nameProblems(s.name)) out.push(`${s.slug}: “${s.name}” ${p}`);
    if (seen.has(s.name)) out.push(`${s.slug}: “${s.name}” is also the name of ${seen.get(s.name)}`);
    else seen.set(s.name, s.slug);
  }
  return out;
}
