// node --test server/lib/parse-executive-order.test.js
//
// The two reference orders were structured by hand before the parser existed; the parser
// should reproduce them from the same Federal Register HTML.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseExecutiveOrder, isNotice } from './parse-executive-order.js';

const REFERENCES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'references');

function load(number) {
  const expected = JSON.parse(fs.readFileSync(path.join(REFERENCES, `eo-${number}.json`), 'utf8'));
  const html = fs.readFileSync(path.join(REFERENCES, `eo-${number}-federal-register.html`), 'utf8');
  const meta = {
    document_number: expected.publication.document_number,
    executive_order_number: expected.number,
    title: expected.title,
    signing_date: expected.signed_date,
    publication_date: expected.publication.date,
    citation: expected.publication.citation,
    volume: expected.publication.volume,
    start_page: expected.publication.start_page,
    end_page: expected.publication.end_page,
    html_url: expected.source.html_url,
    body_html_url: expected.source.body_html_url,
    pdf_url: expected.source.pdf_url,
    president: expected.president,
  };
  return { expected, actual: parseExecutiveOrder(html, meta) };
}

// The hand-made 13636 file only marks deadlines that open a sentence ("Within 120 days…");
// the parser also marks them mid-sentence, so deadlines are compared as a superset.
const withoutDeadlines = items => items.map(item => ({ ...item, spans: item.spans.filter(s => s.type !== 'deadline') }));
const deadlines = items => items.flatMap(item => item.spans.filter(s => s.type === 'deadline').map(s => s.text));

for (const number of ['13636', '14160']) {
  test(`EO ${number} matches the hand-built reference`, () => {
    const { expected, actual } = load(number);

    assert.deepEqual(actual.preamble, expected.preamble);
    assert.equal(actual.sections.length, expected.sections.length);
    actual.sections.forEach((section, i) => {
      const want = expected.sections[i];
      assert.deepEqual(
        { ...section, items: withoutDeadlines(section.items) },
        { ...want, items: withoutDeadlines(want.items) },
        `section ${want.number}`
      );
      const found = deadlines(section.items);
      for (const d of deadlines(want.items)) assert.ok(found.includes(d), `deadline "${d}" in section ${want.number}`);
    });
    assert.deepEqual(actual.signature, expected.signature);
    assert.deepEqual(actual.end_matter, expected.end_matter);
    assert.deepEqual(actual.citations, expected.citations);
    assert.deepEqual(actual.publication, expected.publication);
  });
}

const META = { document_number: '2099-00001', executive_order_number: 99999, title: 'Test' };
const paragraphsHtml = (...paragraphs) => paragraphs.map((p, i) => `<p id="p-${i + 1}" data-page="1">${p}</p>`).join('\n');

test('a spacing entity between the section number and its heading is not part of the text', () => {
  const { sections } = parseExecutiveOrder(
    paragraphsHtml('<strong>Section 1.</strong> &thinsp; <em>Purpose.</em> Chemicals are dangerous.'),
    META
  );
  assert.equal(sections[0].title, 'Purpose');
  assert.equal(sections[0].items[0].text, 'Chemicals are dangerous.');
});

test('quoted provisions are marked, with the nesting of their own markers', () => {
  const { sections } = parseExecutiveOrder(
    paragraphsHtml(
      '<strong>Section 1.</strong> <em>Amendments.</em> (a) Rule II is amended as follows:',
      '(i) The title is revised to read as follows:',
      '&ldquo;&sect;&thinsp;2.1 Competitive examinations and eligible registers.&rdquo;',
      '(ii) 5 CFR 2.1(a) is revised to read as follows:',
      '&ldquo;(a) OPM shall be responsible for:',
      '&ldquo;(i) Open competitive examinations.',
      '&ldquo;(ii) Standards of fitness.&rdquo;',
      '(b) &ldquo;Agency&rdquo; means an executive agency.',
      '&ldquo;Agency&rdquo; also includes military departments.'
    ),
    META
  );
  const items = sections[0].items.map(({ marker, text, quoted, quote_level: level }) => ({ marker, text, quoted, level }));
  assert.deepEqual(items, [
    { marker: 'a', text: 'Rule II is amended as follows:', quoted: undefined, level: undefined },
    { marker: 'i', text: 'The title is revised to read as follows:', quoted: undefined, level: undefined },
    { marker: null, text: '“§ 2.1 Competitive examinations and eligible registers.”', quoted: true, level: 0 },
    { marker: 'ii', text: '5 CFR 2.1(a) is revised to read as follows:', quoted: undefined, level: undefined },
    { marker: null, text: '“(a) OPM shall be responsible for:', quoted: true, level: 1 },
    { marker: null, text: '“(i) Open competitive examinations.', quoted: true, level: 2 },
    { marker: null, text: '“(ii) Standards of fitness.”', quoted: true, level: 2 },
    { marker: 'b', text: '“Agency” means an executive agency.', quoted: undefined, level: undefined },
    { marker: null, text: '“Agency” also includes military departments.', quoted: undefined, level: undefined },
  ]);
});

test('numbered lists are items; inside an open quotation they stay part of the quote', () => {
  const { sections } = parseExecutiveOrder(
    paragraphsHtml(
      '<strong>Section 1.</strong> <em>Agencies.</em> (a) The following agencies:',
      '1. the Department of State;',
      '2. the Department of Defense.',
      '(b) Contracts shall include the following clause:',
      '&ldquo;The contractor agrees as follows:',
      '1. The contractor will comply;',
      '2. The contractor will report.&rdquo;.',
      'This paragraph follows the quotation.'
    ),
    META
  );
  const items = sections[0].items.map(i => [i.marker, i.level, i.quoted ?? false, i.quote_marker ?? null, i.text]);
  assert.deepEqual(items, [
    ['a', 1, false, null, 'The following agencies:'],
    ['1.', 2, false, null, 'the Department of State;'],
    ['2.', 2, false, null, 'the Department of Defense.'],
    ['b', 1, false, null, 'Contracts shall include the following clause:'],
    [null, 0, true, null, '“The contractor agrees as follows:'],
    [null, 0, true, '1.', '1. The contractor will comply;'],
    [null, 0, true, '2.', '2. The contractor will report.”.'],
    [null, 0, false, null, 'This paragraph follows the quotation.'],
  ]);
  assert.deepEqual(sections[0].items.filter(i => i.quoted).map(i => i.quote_level), [0, 1, 1]);
});

test('a memorandum keeps its addressee, and bulleted lists become items', () => {
  const html = `
    <p>Memorandum of June 3, 2013</p>
    <h1 id="h-1">Delegation of Functions</h1>
    <h1 id="h-2">Memorandum for the Secretary of State</h1>
    <p id="p-1" data-page="100">By the authority vested in me as President, I hereby delegate to you the following functions:</p>
    <ul class="bullets">
      <li id="p-2" data-page="100">Section 1244(c)(1) to the Secretary of State;</li>
      <li id="p-3" data-page="100">Section 1244(f) to the Secretary of the Treasury.</li>
    </ul>
    <p id="p-4" data-page="100">You are authorized and directed to publish this memorandum in the <em>Federal Register</em>.</p>
    <div class="signature"><p class="signature-place">THE WHITE HOUSE,</p><p class="signature-date">Washington, June 3, 2013</p></div>`;
  const memo = parseExecutiveOrder(html, {
    document_number: '2013-00001', title: 'Delegation of Functions', doc_type: 'memorandum',
    president: { slug: 'barack-obama', name: 'Barack Obama' },
  });

  assert.equal(memo.doc_type, 'memorandum');
  assert.equal(memo.number, null);
  assert.equal(memo.addressee, 'Memorandum for the Secretary of State');
  assert.equal(memo.subheading, undefined);
  // No numbered sections: the whole text is one unnumbered section, not a preamble.
  assert.deepEqual(memo.preamble, []);
  assert.equal(memo.sections.length, 1);
  assert.equal(memo.sections[0].number, null);
  assert.deepEqual(
    memo.sections[0].items.map(i => [i.bullet ?? false, i.marker, i.text.slice(0, 24)]),
    [
      [false, null, 'By the authority vested '],
      [true, null, 'Section 1244(c)(1) to th'],
      [true, null, 'Section 1244(f) to the S'],
      [false, null, 'You are authorized and d'],
    ]
  );
});

test('notices are told apart from ordinary document numbers', () => {
  assert.equal(isNotice('C1-2009-31418'), true);
  assert.equal(isNotice('R1-2016-03141'), true);
  assert.equal(isNotice('E9-1712'), false);
  assert.equal(isNotice('2013-03915'), false);
});
