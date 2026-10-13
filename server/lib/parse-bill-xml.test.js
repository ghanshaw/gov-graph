// node --test server/lib/parse-bill-xml.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBillXml } from './parse-bill-xml.js';

const XML = `<?xml version="1.0"?>
<!DOCTYPE bill PUBLIC "-//US Congress//DTDs/bill.dtd//EN" "bill.dtd">
<bill bill-stage="Reported-in-Senate">
<form><official-title>To do a thing.</official-title></form>
<legis-body changed="deleted">
  <section id="A"><enum>1.</enum><header>Old text</header><text>The old rule applies.</text></section>
</legis-body>
<legis-body changed="added">
  <section id="B"><enum>1.</enum><header>Short title</header>
    <text>This Act may be cited as the <quote><short-title>Thing Act</short-title></quote>.</text>
    <toc><toc-entry level="section" idref="B">Sec. 1. Short title.</toc-entry>
      <toc-entry level="title" idref="T">TITLE I—Nutrition</toc-entry>
      <toc-entry level="section" idref="C">Sec. 101. Thrifty food plan.</toc-entry></toc></section>
  <title id="T"><enum>I</enum><header>Nutrition</header>
    <section id="C"><enum>101.</enum><header>Thrifty food plan</header>
      <subsection id="D"><enum>(a)</enum><header>In general</header>
        <text>Section 3 of the Act (<external-xref legal-doc="usc" parsable-cite="usc/7/2012">7 U.S.C. 2012</external-xref>)
          is amended by inserting the following:</text>
        <quoted-block id="Q"><subsection id="E"><enum>(u)</enum><header>Plan</header>
          <paragraph id="F"><enum>(1)</enum><text>The term <term>plan</term> means a diet.</text></paragraph>
        </subsection><after-quoted-block>.</after-quoted-block></quoted-block>
      </subsection>
      <subsection id="G"><enum>(b)</enum><text>The Secretary shall—</text>
        <paragraph id="H"><enum>(1)</enum><text>report; and</text></paragraph>
        <continuation-text>not later than 1 year after enactment.</continuation-text>
      </subsection>
    </section>
  </title>
</legis-body>
</bill>`;

test('a reported bill: outline, nested items, quoted text, citations and change marks', () => {
  const bill = parseBillXml(XML, { package_id: 'BILLS-119s1rs' });

  assert.equal(bill.doc_type, 'bill');
  assert.equal(bill.version.stage, 'Reported-in-Senate');
  assert.equal(bill.title, 'To do a thing.');
  assert.equal(bill.short_title, 'Thing Act');

  // Both bodies are kept: the struck original and the substitute.
  assert.deepEqual(bill.sections.map(s => [s.id, s.number, s.changed]), [
    ['sec-1', '1', 'deleted'], ['sec-1-2', '1', 'added'], ['sec-101', '101', 'added'],
  ]);
  assert.deepEqual(bill.outline.map(o => [o.type, o.number]), [['section', '1'], ['section', '1'], ['title', 'I']]);
  assert.deepEqual(bill.outline[2].children, [{ type: 'section', number: '101', heading: 'Thrifty food plan', id: 'sec-101' }]);
  assert.deepEqual(bill.sections[2].path, ['title-i']);

  // The printed table of contents, linked to our own anchors and indented under its title.
  assert.deepEqual(bill.sections[1].items[1].entries, [
    { text: 'Sec. 1. Short title.', depth: 0, kind: 'section', target: 'sec-1-2' },
    { text: 'TITLE I—Nutrition', depth: 0, kind: 'title', target: 'title-i' },
    { text: 'Sec. 101. Thrifty food plan.', depth: 1, kind: 'section', target: 'sec-101' },
  ]);

  const items = bill.sections[2].items;
  assert.deepEqual(items.map(i => [i.marker, i.level, i.quoted ?? false, i.heading ?? null]), [
    ['a', 1, false, 'In general'],
    [null, 0, true, null],
    [null, 0, true, null],
    ['b', 1, false, null],
    ['1', 2, false, null],
    [null, 1, false, null],
  ]);
  // Quoted provisions carry their marker in the text, with the marks around the whole run.
  assert.equal(items[1].text, '“(u) Plan.—');
  assert.equal(items[1].quote_marker, '(u)');
  assert.equal(items[2].text, '(1) The term “plan” means a diet.”.');
  assert.equal(items[2].quote_level, 2);
  assert.equal(items[5].continuation, true);
  assert.ok(items.every(i => i.changed === 'added'));

  for (const item of items) for (const span of item.spans) assert.equal(item.text.slice(span.start, span.end), span.text);
  assert.deepEqual(items[0].spans.map(s => [s.type, s.text]), [['citation', '7 U.S.C. 2012']]);
  assert.deepEqual(items[2].spans.map(s => [s.type, s.text]), [['defined_term', 'plan']]);
  assert.deepEqual(bill.citations, [{
    type: 'usc', title: '7', section: '2012', href: 'https://www.govinfo.gov/link/uscode/7/2012',
    labels: ['7 U.S.C. 2012'], cited_in: ['101'],
  }]);
});

test('a resolution: "Whereas" preamble, resolution body, stage and date', () => {
  const xml = `<?xml version="1.0"?>
<resolution resolution-stage="Introduced-in-House">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dublinCore><dc:date>2025-02-04</dc:date></dublinCore></metadata>
<form><official-title>Expressing support for a thing.</official-title></form>
<preamble>
  <whereas><text>Whereas the thing is good;</text></whereas>
  <whereas><text>Whereas <quote>good things</quote> deserve support: Now, therefore, be it</text></whereas>
</preamble>
<resolution-body>
  <section id="R1" section-type="undesignated-section"><text>That the House of Representatives—</text>
    <paragraph id="R2"><enum>(1)</enum><text>supports the thing; and</text></paragraph>
    <paragraph id="R3"><enum>(2)</enum><text>urges others to.</text></paragraph>
  </section>
</resolution-body>
</resolution>`;
  const res = parseBillXml(xml, { package_id: 'BILLS-119hres100ih' });

  assert.equal(res.version.stage, 'Introduced-in-House');
  assert.equal(res.date, '2025-02-04');
  assert.deepEqual(res.preamble.map(p => p.text), [
    'Whereas the thing is good;',
    'Whereas “good things” deserve support: Now, therefore, be it',
  ]);
  assert.equal(res.sections.length, 1);
  assert.deepEqual([res.sections[0].number, res.sections[0].title], ['', null]);
  assert.deepEqual(res.sections[0].items.map(i => [i.marker, i.level, i.text]), [
    [null, 0, 'That the House of Representatives—'],
    ['1', 1, 'supports the thing; and'],
    ['2', 1, 'urges others to.'],
  ]);
});
