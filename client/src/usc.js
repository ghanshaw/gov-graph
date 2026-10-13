// Shared by the U.S. Code pages (pages/UsCode*.jsx) and by citation links in other documents.

/** The page of a cited Code section ("/code/10/1074c"), or null if the citation is not to one. */
export function uscPath(target) {
  if (target?.type !== 'usc' || !target.title || !target.section) return null;
  // Bill XML cites some sections as "1001 note"; the section is the first word.
  const section = String(target.section).split(/\s/)[0].replace(/[–—]/g, '-');
  // A subsection ("c", "b/1") is an anchor on the section page ("#c", "#b-1").
  const anchor = target.subsection ? `#${target.subsection.split('/').join('-')}` : '';
  return `/code/${String(target.title).toLowerCase()}/${encodeURIComponent(section)}${anchor}`;
}

const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'with']);

/** The Code prints title and chapter names in capitals: "ARMED FORCES" → "Armed Forces". */
export function titleCase(text) {
  if (!text || text !== text.toUpperCase()) return text;
  return text.toLowerCase().replace(/[a-z][a-z’']*/g, (word, offset) => (
    offset > 0 && SMALL.has(word) ? word : word[0].toUpperCase() + word.slice(1)
  ));
}

const KIND_LABEL = {
  subtitle: 'Subtitle', chapter: 'Chapter', subchapter: 'Subchapter', part: 'Part', subpart: 'Subpart',
  division: 'Division', subdivision: 'Subdivision', article: 'Article',
};

/** "Chapter 55" from a container's kind and number, when its printed label is missing. */
export const containerName = node => (node.label
  // "PART II—" → "Part II": the kind in title case, the number as printed.
  ? node.label.replace(/[—–-]\s*$/, '').trim().replace(/^[A-Z]+\b/, kind => kind[0] + kind.slice(1).toLowerCase())
  : [KIND_LABEL[node.kind], node.number].filter(Boolean).join(' '));

/** "§ 1074c", the label without its closing period or the brackets of a repealed section. */
export const sectionName = node => (node.label ?? node.number ?? '').replace(/^\[|\.?\]?$/g, '').replace(/\.$/, '');

export const STATUS_LABEL = {
  repealed: 'Repealed', transferred: 'Transferred', omitted: 'Omitted', renumbered: 'Renumbered', reserved: 'Reserved',
};

/** The Law Revision Counsel's page for a section (its current text and notes). */
export const olrcUrl = (title, section) =>
  `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title${title}-section${section}&num=0&edition=prelim`;
