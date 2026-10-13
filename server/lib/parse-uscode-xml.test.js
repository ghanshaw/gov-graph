import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseUscodeTitle, refTarget, sectionSlug } from './parse-uscode-xml.js';

// Cut from the 119-36 release point: the title, the containers above one section, the sections.
const REFERENCES = path.join(dirname(fileURLToPath(import.meta.url)), '..', 'references');
const read = name => parseUscodeTitle(fs.readFileSync(path.join(REFERENCES, name), 'utf8'));
const section = (parsed, identifier) => parsed.nodes.find(n => n.identifier === identifier);

test('title metadata and hierarchy (10 U.S.C. 1074c)', () => {
  const parsed = read('usc-t10-s1074c.xml');
  assert.deepEqual(parsed.title, {
    identifier: '/us/usc/t10', number: '10', label: 'Title 10—', name: 'ARMED FORCES',
    positive_law: true, appendix: false, release: '119-36',
  });
  assert.deepEqual(parsed.warnings, []);
  assert.deepEqual(parsed.nodes.map(n => [n.kind, n.identifier, n.parent, n.depth]), [
    ['subtitle', '/us/usc/t10/stA', '/us/usc/t10', 0],
    ['part', '/us/usc/t10/stA/ptII', '/us/usc/t10/stA', 1],
    ['chapter', '/us/usc/t10/stA/ptII/ch55', '/us/usc/t10/stA/ptII', 2],
    ['section', '/us/usc/t10/s1074c', '/us/usc/t10/stA/ptII/ch55', 3],
    ['section', '/us/usc/t10/s115b', '/us/usc/t10/stA/ptII/ch55', 3],
  ]);
});

test('a section with one paragraph, its source credit and notes', () => {
  const s = section(read('usc-t10-s1074c.xml'), '/us/usc/t10/s1074c');
  assert.equal(s.slug, '1074c');
  assert.equal(s.label, '§ 1074c.');
  assert.equal(s.heading, 'Medical care: authority to provide a wig');
  assert.equal(s.status, null);
  assert.deepEqual(s.structure.items, [{
    marker: null, level: 0, spans: [],
    text: 'A person entitled to medical care under this chapter who has alopecia resulting from the treatment of a malignant disease may be furnished a wig if the person has not previously been furnished one at the expense of the United States.',
  }]);
  assert.deepEqual(s.structure.source_credit.laws, [
    { public_law: '98-525', cite: 'Pub. L. 98–525, title XIV, § 1401(e)(2)(A)', date: '1984-10-19', statute: '98 Stat. 2616' },
    { public_law: '102-190', cite: 'Pub. L. 102–190, div. A, title VI, § 640(a)(1)', date: '1991-12-05', statute: '105 Stat. 1385' },
  ]);
  assert.match(s.structure.source_credit.text, /^\(Added Pub\. L\. 98–525/);
  assert.deepEqual(s.structure.notes.map(n => [n.topic, n.heading, Boolean(n.cross_heading)]), [
    ['editorialNotes', 'Editorial Notes', true],
    ['priorProvisions', 'Prior Provisions', false],
    ['amendments', 'Amendments', false],
    ['statutoryNotes', 'Statutory Notes and Related Subsidiaries', true],
    ['effectiveDate', 'Effective Date', false],
  ]);
  const amendment = s.structure.notes.find(n => n.topic === 'amendments').items[0];
  assert.equal(amendment.text, '1991—Pub. L. 102–190 renumbered section 1074b of this title as this section.');
  assert.deepEqual(amendment.spans.map(x => x.target), [
    { type: 'public_law', congress: '102', number: '190' },
    { type: 'usc', title: '10', section: '1074b' },
  ]);
});

test('a repealed section', () => {
  const s = section(read('usc-t10-s1074c.xml'), '/us/usc/t10/s115b');
  assert.equal(s.status, 'repealed');
  assert.match(s.heading, /^Repealed\. Pub\. L\. 114–328/);
  assert.deepEqual(s.structure.items, []);
});

test('nested provisions, anchors and footnotes (5 U.S.C. 8335)', () => {
  const s = section(read('usc-t5-s8335.xml'), '/us/usc/t5/s8335');
  const items = s.structure.items;
  assert.deepEqual(items.map(i => [i.marker, i.level, i.anchor]), [
    ['a', 1, 'a'], ['b', 1, 'b'], ['1', 2, 'b-1'], ['2', 2, 'b-2'], ['c', 1, 'c'], ['d', 1, 'd'], ['f', 1, 'f'],
  ]);
  assert.equal(items[1].text, '');
  assert.match(items[4].text, /^A member of the Capitol Police .* becomes 57 years of age/);
  // A footnote call: no length, the number, and the footnote it points to.
  const call = items[0].spans.find(x => x.type === 'footnote_ref');
  assert.equal(call.start, call.end);
  assert.equal(items[0].text.slice(call.start - 15, call.start), 'section 8331(29)(A).'.slice(-15));
  assert.equal(call.number, '1');
  assert.deepEqual(s.structure.footnotes.find(f => f.id === call.target), { id: call.target, number: '1', text: 'See References in Text note below.' });
});

test('headings, continuation text, tables, en dashes and ranges (title 42)', () => {
  const parsed = read('usc-t42-s242k.xml');
  const k = section(parsed, '/us/usc/t42/s242k').structure.items;
  assert.deepEqual(
    { marker: k[0].marker, heading: k[0].heading, heading_break: k[0].heading_break },
    { marker: 'a', heading: 'Establishment; appointment of Director; statistical and epidemiological activities', heading_break: true },
  );
  // "Amounts appropriated …" follows paragraphs (1)–(4) of subsection (b), at its depth.
  const resumed = k.find(i => i.continuation);
  assert.match(resumed.text, /^Amounts appropriated to the Secretary/);
  assert.equal(resumed.level, 1);
  assert.equal(k[k.indexOf(resumed) - 1].anchor, 'b-4');

  const dashed = section(parsed, '/us/usc/t42/s300h–6');
  assert.equal(dashed.slug, '300h-6');
  const table = dashed.structure.items.find(i => i.type === 'table');
  assert.deepEqual(table.head, [['Fiscal year:', 'Amount']]);
  assert.ok(table.rows.length > 0);

  const range = section(parsed, '/us/usc/t42/s71...71l');
  assert.deepEqual([range.number, range.status, range.slug], ['71 to 71l', 'transferred', '71...71l']);
});

test('references', () => {
  assert.deepEqual(refTarget('/us/usc/t42/s300h–6/b/1'), {
    target: { type: 'usc', title: '42', section: '300h-6', subsection: 'b/1' },
    href: 'https://www.govinfo.gov/link/uscode/42/300h-6',
  });
  assert.deepEqual(refTarget('/us/usc/t10/ch55'), { target: { type: 'usc', title: '10', unit: 'ch55' }, href: null });
  assert.deepEqual(refTarget('/us/pl/98/525/tXIV'), {
    target: { type: 'public_law', congress: '98', number: '525' }, href: 'https://www.govinfo.gov/link/plaw/98/public/525',
  });
  assert.deepEqual(refTarget('/us/stat/70A/1'), {
    target: { type: 'statute', volume: '70A', page: '1' }, href: 'https://www.govinfo.gov/link/statute/70A/1',
  });
  assert.equal(sectionSlug('1395w–4'), '1395w-4');
});
