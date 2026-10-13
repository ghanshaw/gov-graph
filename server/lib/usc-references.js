/**
 * References to the U.S. Code written out in text that the publisher did not mark up.
 *
 * GPO's bill XML tags the parenthetical form ("(20 U.S.C. 1001)") but usually not the wording
 * amending bills use: "Section 1074c of title 10, United States Code, is amended …". These
 * become citation spans of the same shape the parsers produce (target `usc`), marked
 * `recognized: true`, so the text links to the section's page. Spans already in the text win.
 *
 * Only the reference is found here; what the text does to the section (amends, repeals, …)
 * is a later step (see features/us-code).
 */

const SEC = String.raw`\d+[A-Za-z]*(?:[–-]\d+[A-Za-z]*)*`;
const SUB = String.raw`(?:\([A-Za-z0-9]+\))*`;
const TITLE = String.raw`(\d+[A-Za-z]?)`;
const ONE = `(${SEC})(${SUB})`;

// "section 1074c of title 10, United States Code" / "section 8335(c) of title 5, United States Code"
const SINGLE = new RegExp(String.raw`\b[Ss]ection ${ONE} of title ${TITLE}, United States Code`, 'g');
// "sections 8335(c) and 8425(c) of title 5, United States Code"; "sections 101, 102, and 103 of title 10, …"
const LIST = new RegExp(
  String.raw`\b[Ss]ections ((?:${SEC}${SUB})(?:(?:,? (?:and|or|through)|,) (?:${SEC}${SUB}))+),? of title ${TITLE}, United States Code`,
  'g',
);
// "10 U.S.C. 1074c", written out without markup
const SHORT = new RegExp(String.raw`\b${TITLE} U\.S\.C\. (?:§+ ?)?${ONE}`, 'g');

const sectionOf = section => section.replace(/[–—]/g, '-');
const subsectionOf = sub => sub.replace(/^\(|\)$/g, '').split(')(').join('/');

function citation(start, end, text, title, section, sub) {
  return {
    start, end, type: 'citation',
    target: { type: 'usc', title: title.toLowerCase(), section: sectionOf(section), ...(sub ? { subsection: subsectionOf(sub) } : {}) },
    href: `https://www.govinfo.gov/link/uscode/${title.toLowerCase()}/${sectionOf(section)}`,
    recognized: true,
    text: text.slice(start, end),
  };
}

/** Citation spans for the written-out U.S. Code references in a piece of text. */
export function findUscReferences(text) {
  const found = [];
  for (const m of text.matchAll(LIST)) {
    // Each section in the list links on its own; "of title 5, United States Code" does not.
    const listStart = m.index + m[0].indexOf(m[1]);
    for (const s of m[1].matchAll(new RegExp(ONE, 'g'))) {
      const start = listStart + s.index;
      found.push(citation(start, start + s[0].length, text, m[2], s[1], s[2]));
    }
  }
  for (const m of text.matchAll(SINGLE)) found.push(citation(m.index, m.index + m[0].length, text, m[3], m[1], m[2]));
  for (const m of text.matchAll(SHORT)) found.push(citation(m.index, m.index + m[0].length, text, m[1], m[2], m[3]));
  return found.sort((a, b) => a.start - b.start);
}

const overlaps = (a, b) => a.start < b.end && b.start < a.end;

/** An item with the references found in its text added to its spans, where nothing else is. */
export function withUscReferences(item) {
  if (!item?.text || !/United States Code|U\.S\.C\./.test(item.text)) return item;
  const spans = item.spans ?? [];
  const added = [];
  for (const span of findUscReferences(item.text)) {
    if (!spans.some(s => overlaps(s, span)) && !added.some(s => overlaps(s, span))) added.push(span);
  }
  if (added.length === 0) return item;
  return { ...item, spans: [...spans, ...added].sort((a, b) => a.start - b.start) };
}
