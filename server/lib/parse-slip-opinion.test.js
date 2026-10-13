// node --test server/lib/parse-slip-opinion.test.js
//
// Trump v. Slaughter (2026), read from the Court's slip opinion PDF. Unlike the executive
// order references, trump-v-slaughter.json was written by the parser, not by hand: the
// facts asserted here were checked against the printed PDF, and the file guards the rest
// against unintended change. To regenerate it after a deliberate change:
//   node --env-file=server/.env server/seed/load-case-text.js --cluster 10881681 --dry-run --json server/references/trump-v-slaughter.json

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractPdfLines } from './pdf-lines.js';
import { parseSlipOpinion, checkDecision } from './parse-slip-opinion.js';
import { splitForStorage, membersOn, slugOfDocket, kindOf } from './decision-storage.js';

const REFERENCES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'references');
const expected = JSON.parse(fs.readFileSync(path.join(REFERENCES, 'trump-v-slaughter.json'), 'utf8'));

const pages = await extractPdfLines(fs.readFileSync(path.join(REFERENCES, 'trump-v-slaughter-slip-opinion.pdf')));
const parsed = parseSlipOpinion(pages, {
  case_name: expected.case_name,
  members: membersOn('2026-06-29'),
  pdf_url: expected.source.pdf_url,
  source: { courtlistener_cluster: 10881681 },
});

const [majority, concurrence, dissent] = parsed.opinions;
const items = opinion => opinion.sections.flatMap(s => s.items);
const everyItem = [
  ...parsed.syllabus.items,
  ...parsed.opinions.flatMap(o => [...items(o), ...o.footnotes.flatMap(n => n.items)]),
];
const paragraph = (opinion, start) => items(opinion).find(item => item.text.startsWith(start));

test('reads the caption block', () => {
  assert.equal(pages.length, 108);
  assert.equal(parsed.caption, 'TRUMP, PRESIDENT OF THE UNITED STATES, ET AL. v. SLAUGHTER');
  assert.equal(parsed.proceeding, 'CERTIORARI BEFORE JUDGMENT TO THE UNITED STATES COURT OF APPEALS FOR THE DISTRICT OF COLUMBIA CIRCUIT');
  assert.equal(parsed.docket_number, '25-332');
  assert.equal(parsed.argued_date, '2025-12-08');
  assert.equal(parsed.decided_date, '2026-06-29');
  assert.equal(parsed.term, 'October Term, 2025');
  assert.equal(parsed.citation, '609 U. S. ___ (2026)');
});

test('splits the syllabus into its points, the judgment and the line-up', () => {
  const { syllabus } = parsed;
  assert.equal(syllabus.pages, 7);
  assert.equal(syllabus.disposition, 'Reversed and remanded.');
  assert.match(syllabus.lineup, /^ROBERTS, C\. J\., delivered the opinion of the Court, .* in which KAGAN and JACKSON, JJ\., joined\.$/);
  assert.match(syllabus.items[2].text, /^Held: The FTC’s for-cause removal provision is contrary to/);
  // (a) … (e), with (1), (2) under (a) and (b), and (i)–(iii) under (b)(2)
  assert.deepEqual(
    syllabus.items.filter(i => i.marker).map(i => `${i.level}${i.marker}`),
    ['1a', '21', '22', '1b', '21', '22', '3i', '3ii', '3iii', '1c', '1d', '1e']
  );
  // The marker is taken out of the text; an unmarked paragraph belongs to the point above it.
  assert.match(syllabus.items[3].text, /^The Constitution vests “\[t\]he executive Power”/);
  assert.equal(syllabus.items[5].continuation, true);
  assert.equal(syllabus.items[5].level, 2);
});

test('finds each writing by its running head', () => {
  assert.deepEqual(parsed.opinions.map(o => [o.id, o.kind, o.author, o.pages]), [
    ['majority', 'majority', 'Roberts', 36],
    ['concurrence-gorsuch', 'concurrence', 'Gorsuch', 16],
    ['dissent-sotomayor', 'dissent', 'Sotomayor', 49],
  ]);
  assert.equal(majority.byline, 'CHIEF JUSTICE ROBERTS delivered the opinion of the Court.');
  assert.equal(dissent.byline, 'JUSTICE SOTOMAYOR, with whom JUSTICE KAGAN and JUSTICE JACKSON join, dissenting.');
  assert.deepEqual(dissent.joined_by, ['Kagan', 'Jackson']);
  // The caption block repeated at the head of each opinion is not text.
  assert.ok(!everyItem.some(i => /SUPREME COURT OF THE UNITED STATES|ON WRIT OF CERTIORARI|^NOTICE:/.test(i.text)));
});

test('turns centred headings into nested parts', () => {
  assert.deepEqual(majority.sections.map(s => s.path.join('-')), [
    '', 'I', 'II', 'II-A', 'II-A-1', 'II-A-2', 'II-B', 'II-B-1', 'II-B-2', 'II-B-2-a', 'II-B-2-b', 'II-B-2-c',
    'III', 'III-A', 'III-B', 'IV', '',
  ]);
  assert.equal(majority.sections.at(-1).heading, '* * *');
  assert.equal(majority.sections.at(-1).id, 'majority-end');
  assert.deepEqual(concurrence.sections.map(s => s.path.join('-')), ['', 'I', 'I-A', 'I-B', 'I-C', 'I-D', 'II', 'II-A', 'II-B', '']);
  assert.equal(dissent.sections.length, 21);
  assert.equal(dissent.sections[12].id, 'dissent-sotomayor-II-B-3');
  // A part that only holds sub-parts has no text of its own.
  assert.equal(majority.sections[2].items.length, 0);
});

test('joins lines into paragraphs across line and page breaks', () => {
  // "Pres-" / "ident" over a page break; "quasi-" / "legislative" keeps its own hyphen;
  // "Web-" / "ster" does not.
  assert.ok(items(majority).some(i => i.text.includes('those officers must be removable by the President.')));
  assert.ok(paragraph(majority, 'The District Court agreed').text.includes('solely “quasi-legislative” and “quasi-judicial” functions'));
  assert.ok(everyItem.some(i => i.text.includes('As Webster—still in the Senate—put it 15 years later:')));
  assert.ok(everyItem.some(i => i.text.includes('in-house')));
  assert.ok(!everyItem.some(i => /[a-z]- [a-z]/.test(i.text)));
  assert.equal(items(majority)[0].page, 1);
  assert.match(items(majority)[0].text, /^Nearly 250 years ago, the Framers decided to vest “\[t\]he executive Power” in one person/);
});

test('marks block quotations, italics and the closing line', () => {
  const quoted = items(majority).filter(i => i.quoted);
  assert.equal(quoted.length, 1);
  assert.match(quoted[0].text, /^“\[S\]ince the practice has become a settled practice,.*Cong\. Globe, 31st Cong\., 1st Sess\., 1126 \(1850\)\.$/);

  const closing = items(majority).at(-1);
  assert.equal(closing.text, 'It is so ordered.');
  assert.equal(closing.align, 'right');

  const emphasis = paragraph(majority, 'The District Court agreed').spans.filter(s => s.type === 'emphasis').map(s => s.text);
  assert.deepEqual(emphasis.slice(0, 4), ['Myers', 'Myers', 'Humphrey’s Executor', 'United States']);
});

test('separates footnotes and marks where they are called', () => {
  assert.deepEqual(parsed.opinions.map(o => o.footnotes.length), [9, 1, 14]);
  assert.match(majority.footnotes[0].items[0].text, /^Slaughter was initially joined in her lawsuit by Bedoya,.*Slaughter’s claims are at issue here\.$/);
  // Footnote 8 of the Court's opinion runs on under the rule of the next page.
  assert.match(majority.footnotes[7].items[0].text, /^Searching for earlier precedents,.*Abraham Lincoln: A Life 55, 456, 657 \(2008\)\.$/);

  const called = paragraph(majority, 'Slaughter promptly filed suit');
  const ref = called.spans.find(s => s.type === 'footnote_ref');
  assert.deepEqual(ref, { type: 'footnote_ref', start: 150, end: 150, number: '1', target: 'majority-fn-1' });
  assert.equal(called.text.slice(143, 155), 'office. She ');

  // Every footnote is called exactly once from its own opinion.
  for (const opinion of parsed.opinions) {
    const calls = items(opinion).flatMap(i => i.spans.filter(s => s.type === 'footnote_ref').map(s => s.number));
    assert.deepEqual(calls, opinion.footnotes.map(n => n.number));
  }
});

test('links citations and counts them per writing', () => {
  const find = label => parsed.citations.find(c => c.labels[0] === label);
  assert.deepEqual(find('Myers v. United States, 272 U. S. 52 (1926)'), {
    type: 'case', reporter: 'U. S.', volume: 272, page: 52,
    href: 'https://www.courtlistener.com/c/U.S./272/52/',
    labels: ['Myers v. United States, 272 U. S. 52 (1926)'],
    cited_in: find('Myers v. United States, 272 U. S. 52 (1926)').cited_in,
    mentions: find('Myers v. United States, 272 U. S. 52 (1926)').mentions,
    name: 'Myers v. United States', year: 1926,
  });
  // "295 U. S., at 628" is Humphrey's (begins at 602), "at 534" Schechter (495), "at 575" Radford (555).
  const humphreys = find('Humphrey’s Executor v. United States, 295 U. S. 602 (1935)');
  assert.deepEqual(humphreys.mentions, { syllabus: 5, majority: 12, 'concurrence-gorsuch': 4, 'dissent-sotomayor': 12 });
  assert.equal(find('A. L. A. Schechter Poultry Corp. v. United States, 295 U. S. 495 (1935)').mentions.majority, 2);
  assert.ok(find('Kendall v. United States ex rel. Stokes, 12 Pet. 524 (1838)'));
  assert.equal(find('Marbury v. Madison, 1 Cranch 137 (1803)').href, 'https://www.courtlistener.com/c/Cranch/1/137/');
  // No page yet, so nothing to link to.
  assert.equal(find('Trump v. Wilcox, 605 U. S. ___ (2025)').href, null);

  assert.equal(find('15 U. S. C. §41').href, 'https://www.govinfo.gov/link/uscode/15/41');
  assert.equal(find('42 U. S. C. §2000e–5').href, 'https://www.govinfo.gov/link/uscode/42/2000e-5');
  assert.equal(find('38 Stat. 717').href, 'https://www.govinfo.gov/link/statute/38/717');
  assert.equal(find('90 Fed. Reg. 10447').href, 'https://www.federalregister.gov/citation/90-FR-10447');

  const types = {};
  for (const c of parsed.citations) types[c.type] = (types[c.type] ?? 0) + 1;
  assert.deepEqual(types, { case: 71, usc: 17, statute: 20, federal_register: 4 });

  // Spans never overlap, and each covers the text it says it does.
  for (const item of everyItem) {
    let pos = 0;
    for (const span of item.spans) {
      assert.ok(span.start >= pos, `overlap in "${item.text.slice(0, 40)}"`);
      if (span.text) assert.equal(item.text.slice(span.start, span.end), span.text);
      pos = span.end;
    }
  }
});

test('reads the outcome from the line-up', () => {
  const { outcome } = parsed;
  assert.equal(outcome.disposition, 'Reversed and remanded.');
  assert.deepEqual(outcome.vote, { majority: 6, dissent: 3 });
  assert.deepEqual(
    outcome.justices.map(j => `${j.name}:${j.side}:${j.wrote.join('+')}:${j.joined.map(x => x.opinion + (x.qualifier ? ` ${x.qualifier}` : '')).join('+')}`),
    // In the Court's order of seniority, Chief Justice first.
    [
      'Roberts:majority:majority:', 'Thomas:majority::majority as to all but Part III–B', 'Alito:majority::majority',
      'Sotomayor:dissent:dissent-sotomayor:', 'Kagan:dissent::dissent-sotomayor', 'Gorsuch:majority:concurrence-gorsuch:majority',
      'Kavanaugh:majority::majority', 'Barrett:majority::majority', 'Jackson:dissent::dissent-sotomayor',
    ]
  );
  // Where each writing and part starts in the PDF file (page 8 is page 1 of the opinion).
  assert.deepEqual(parsed.opinions.map(o => o.pdf_page), [8, 44, 60]);
  assert.equal(majority.sections.find(s => s.id === 'majority-III-B').pdf_page, 34);
});

test('addresses the decision by its docket number', () => {
  assert.equal(slugOfDocket('25-332'), '25-332');
  assert.equal(slugOfDocket('145, Orig.'), '145-orig');
  assert.equal(slugOfDocket('24A884'), '24a884');
  assert.equal(kindOf(parsed), 'argued');
  assert.equal(kindOf({ docket_number: '65, Orig.', opinions: [] }), 'original');
  assert.equal(kindOf({ docket_number: '19-1302', argued_date: null, opinions: [{ kind: 'per_curiam' }] }), 'per_curiam');
});

test('finds nothing wrong with it', () => {
  assert.deepEqual(checkDecision(parsed), []);
});

test('matches the stored reference', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), expected);
});

test('stores the opinions apart from the head', () => {
  const { head, opinions } = splitForStorage(parsed);
  assert.equal(opinions.length, 3);
  assert.equal(head.opinions[0].sections, undefined);
  assert.equal(head.opinions[0].footnote_count, 9);
  assert.deepEqual(head.opinions[0].outline[4], {
    id: 'majority-II-A-1', heading: '1', path: ['II', 'A', '1'], level: 3, pdf_page: 12,
    opening: 'The idea that one President would be in charge was by no means a foregone conclu',
  });
});
