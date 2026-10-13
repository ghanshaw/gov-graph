// node --test server/lib/parse-commission-html.test.js
// Fragments in the shape of the 9/11 Commission's HTML (9-11commission.gov/report), including its slips.

import test from 'node:test';
import assert from 'node:assert/strict';
import { contentOf, readBlocks, readPart, readNotes, recoverCalls, checkPart, splitByHeading } from './parse-commission-html.js';

const page = body => `<html><body><table><tr><td><div class="navText"><a href="report/index.htm">Report</a></div>
<p>
${body}
</td></tr></table>
<!-- SideNav -->
<td><strong>Current News</strong></td></body></html>`;

const CHAPTER = page(`<h2 align="center">1<p>
"WE HAVE SOME PLANES"</h2>
<p>Tuesday, September 11, 2001, dawned temperate and nearly cloudless.
<p><h4>1.1 INSIDE THE FOUR FLIGHTS </h4>
<p><strong>Boarding the Flights<br>
Boston: American 11 and United 175</strong>. Atta and Omari boarded a 6:00 A.M. flight.<sup>1</sup>
<p>They spoke for three minutes.<sup>2 </sup> It would be their final <em>conversation</em>.
<p>Hazmi stayed on his way to Afghanistan for jihad training.3
<p><table align="center" width="100%" border="1" cellpadding="10">
	<tr>
		<td><p><strong>Flights of Saudi Nationals</strong><br>
Three questions have arisen.
<p>First, we found no evidence.<sup>4</sup>
</td></tr></table>
<ul>
<li> attack terrorists and their organizations;
<li>prevent the continued growth of Islamist terrorism.
</ul>
<p><strong>Recommendation: Emergency response agencies nationwide should adopt the Incident Command System</strong>.</p>`);

const NOTES = page(`<h2 align="center">NOTES</h2>
<p>For simplicity, we have adopted the following citation conventions.
<p><h2>1 "We Have Some Planes"</h2>
<p>1. No physical evidence explains why. Michael Touhey interview (May 27, 2004).
<p>2. See FAA report, May 2001, p. 110. 3."Hunting Bin Ladin," PBS <em>Frontline</em>, May 1998.
<p>A second paragraph of note 3.
<blockquote><p>1. <strong>Muhammad al Kahtani</strong>. A list inside the note.</blockquote>
<p>4. Ibid.
<p><h2>2 The Foundation of the New Terrorism</h2>
<p>1. "Text of World Islamic Front's Statement."`);

function chapterOne() {
  const part = readPart(readBlocks(contentOf(CHAPTER)), 'ch1');
  part.notes = readNotes(readBlocks(contentOf(NOTES))).get('1');
  return part;
}

test('a chapter: title, numbered sections, headings set on their own line and run in', () => {
  const part = chapterOne();
  assert.equal(part.title, '1 "WE HAVE SOME PLANES"');
  assert.deepEqual(part.sections.map(s => [s.number, s.heading]), [[null, null], ['1.1', 'INSIDE THE FOUR FLIGHTS']]);
  const [heading, runIn] = part.sections[1].items;
  assert.deepEqual(heading, { subheading: true, text: 'Boarding the Flights', spans: [] });
  assert.equal(runIn.run_in, 'Boston: American 11 and United 175.');
  assert.equal(runIn.text, 'Atta and Omari boarded a 6:00 A.M. flight.');
  assert.deepEqual(runIn.spans, [{ type: 'footnote_ref', start: 42, end: 42, number: '1', target: 'ch1-n1' }]);
});

test('note calls are zero-length spans; emphasis is kept', () => {
  const item = chapterOne().sections[1].items[2];
  assert.equal(item.text, 'They spoke for three minutes. It would be their final conversation.');
  assert.deepEqual(item.spans.map(s => [s.type, s.start, s.end]), [['footnote_ref', 29, 29], ['emphasis', 54, 66]]);
});

test('a one-column table of paragraphs is a box, not a table', () => {
  const items = chapterOne().sections[1].items.filter(i => i.box);
  assert.deepEqual(items.map(i => i.subheading ? `# ${i.text}` : i.text), ['# Flights of Saudi Nationals', 'Three questions have arisen.', 'First, we found no evidence.']);
  assert.ok(items.every(i => i.box === 1));
});

test('bullets and recommendations', () => {
  const items = chapterOne().sections[1].items;
  assert.deepEqual(items.filter(i => i.bullet).map(i => i.text), ['attack terrorists and their organizations;', 'prevent the continued growth of Islamist terrorism.']);
  const rec = items.find(i => i.recommendation);
  assert.equal(rec.text, 'Emergency response agencies nationwide should adopt the Incident Command System.');
});

test('notes: run together in one paragraph, continued, with a numbered list of their own', () => {
  const notes = readNotes(readBlocks(contentOf(NOTES)));
  assert.deepEqual([...notes.keys()], ['1', '2']);
  const one = notes.get('1');
  assert.deepEqual(one.map(n => n.number), ['1', '2', '3', '4']);
  assert.equal(one[1].items[0].text, 'See FAA report, May 2001, p. 110.');
  assert.equal(one[2].items[0].text, '"Hunting Bin Ladin," PBS Frontline, May 1998.');
  assert.equal(one[2].items.length, 3);
  assert.equal(one[2].items[2].quoted, true);
  assert.equal(one[0].id, 'ch1-n1');
});

test('a call printed as plain digits is recovered; checkPart then finds nothing wrong', () => {
  const part = chapterOne();
  assert.deepEqual(checkPart(part), ['notes never called: 3']);
  assert.deepEqual(recoverCalls(part), [3]);
  const item = part.sections[1].items[3];
  assert.equal(item.text, 'Hazmi stayed on his way to Afghanistan for jihad training.');
  assert.deepEqual(item.spans, [{ type: 'footnote_ref', start: 58, end: 58, number: '3', target: 'ch1-n3' }]);
  assert.deepEqual(checkPart(part), []);
});

test('the appendix file splits by heading', () => {
  const html = page(`<p><h2 align="center">APPENDIX A<br>
COMMON ABBREVIATIONS</h2>
<table align="center" width="80%"><tr valign="top"><td>CAP</td><td>combat air patrol</td></tr>
<tr><td>CIA<td>Central Intelligence Agency</tr></table>
<p><h2 align="center">APPENDIX B<br>TABLE OF NAMES</h2><p>Names.`);
  const parts = splitByHeading(readBlocks(contentOf(html)));
  assert.deepEqual(parts.map(p => p.heading), ['APPENDIX A COMMON ABBREVIATIONS', 'APPENDIX B TABLE OF NAMES']);
  const a = readPart(parts[0].blocks, 'app-a');
  assert.deepEqual(a.sections[0].items[0].rows, [['CAP', 'combat air patrol'], ['CIA', 'Central Intelligence Agency']]);
});
