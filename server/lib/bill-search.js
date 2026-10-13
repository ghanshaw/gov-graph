/**
 * Bill search: reading a bill or law identifier out of a search box, and ranking the titles a
 * bill is known by (bill_titles, filled by seed/load-bill-status-bulk.js).
 */

// Every way a bill type is printed, reduced to letters only ("H. J. Res." → "hjres").
const TYPE_SPELLINGS = {
  hr: 'hr', house: 'hr', housebill: 'hr', hb: 'hr',
  s: 's', senate: 's', senatebill: 's', sb: 's',
  hres: 'hres', houseresolution: 'hres',
  sres: 'sres', senateresolution: 'sres',
  hjres: 'hjres', hjointres: 'hjres', housejointresolution: 'hjres',
  sjres: 'sjres', sjointres: 'sjres', senatejointresolution: 'sjres',
  hconres: 'hconres', hcres: 'hconres', houseconcurrentresolution: 'hconres',
  sconres: 'sconres', scres: 'sconres', senateconcurrentresolution: 'sconres',
};

const ORDINAL = '(\\d{1,3})(?:st|nd|rd|th)?';

/**
 * A search that is only an identifier → what it names, or null for a search by words.
 *
 *   "H.R. 1", "hr1", "H. J. Res. 12", "Senate Bill 5"  → { kind: 'bill', type: 'hr', number: '1' }
 *   "H.R. 1 119th Congress", "119 hr 1", "119-hr-1"    → the same with congress: 119
 *   "Public Law 119-21", "P.L. 119-21", "Pub. L. No. 119-21", "Private Law 115-1"
 *                                                      → { kind: 'law', lawType: 'public', congress: 119, number: '21' }
 */
export function parseBillQuery(input) {
  let q = (input ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q) return null;

  const law = new RegExp(`^(?:(public|private|pub|priv|pvt|p)\\.? ?(?:law|l)\\.?)(?: ?no\\.?)? ?(\\d{1,3}) ?[-–] ?(\\d{1,4})$`).exec(q);
  if (law) {
    return { kind: 'law', lawType: /^(private|priv|pvt)/.test(law[1]) ? 'private' : 'public', congress: Number(law[2]), number: String(Number(law[3])) };
  }

  // The Congress may come first ("119 hr 1", "119-hr-1", "119th Congress H.R. 1") or last
  // ("H.R. 1 (119th Congress)", "hr1-119", "H.R. 1, 119th").
  let congress = null;
  const lead = new RegExp(`^${ORDINAL}(?: congress)?[ ,:-]+(?=[a-z])`).exec(q);
  if (lead) { congress = Number(lead[1]); q = q.slice(lead[0].length); }
  else {
    const tail = new RegExp(`[ ,(-]+(?:the )?${ORDINAL}(?: congress)?\\)?$`).exec(q);
    // Only after a number: "S. 119" alone is a bill number, not a Congress.
    if (tail && /\d[ ,(-]/.test(q.slice(Math.max(0, tail.index - 1), tail.index + 1))) {
      congress = Number(tail[1]); q = q.slice(0, tail.index);
    }
  }

  const bill = /^([a-z. ]+?)[ .-]*(\d{1,5})$/.exec(q.trim());
  if (!bill) return null;
  const type = TYPE_SPELLINGS[bill[1].replace(/[^a-z]/g, '')];
  if (!type) return null;
  if (congress !== null && (congress < 1 || congress > 200)) return null;
  return { kind: 'bill', ...(congress ? { congress } : {}), type, number: String(Number(bill[2])) };
}

/**
 * Congress.gov's title type ("Short Title(s) as Passed House", "Popular Titles", "Official
 * Title as Introduced", …) → the kind of name it is:
 *   popular  — a name CRS assigns to a bill known by it ("One Big Beautiful Bill Act")
 *   short    — the bill's own short title, at any stage
 *   portion  — the short title of one part of the bill ("FEHB Protection Act of 2025")
 *   display  — the title Congress.gov shows for the bill
 *   official — the long title ("To provide for reconciliation …")
 */
export function titleKind(titleType) {
  const t = (titleType ?? '').toLowerCase();
  if (t.startsWith('popular')) return 'popular';
  if (t.includes('display')) return 'display';
  if (t.includes('short')) return t.includes('portion') ? 'portion' : 'short';
  return 'official';
}

/**
 * How much a match on each kind of title counts, best first. `common` is a name in common use that
 * no publisher records, added by us (seed/data/bill-names.json).
 */
export const KIND_WEIGHT = { popular: 5, common: 5, short: 4, display: 3, official: 2, portion: 1 };
