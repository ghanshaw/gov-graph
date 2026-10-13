/**
 * A Supreme Court slip opinion (the PDF the Court publishes on decision day) → structured
 * form, in the shape the executive order and bill parsers produce: sections → items → spans,
 * plus citations. See parse-executive-order.js, parse-bill-xml.js and
 * research/legal-document-structure.md.
 *
 * Input is the printed lines of the PDF (pdf-lines.js). The Court publishes no structured
 * text, so the structure is read from the typesetting, which is very regular:
 *   - every page has a page number line and a running head ("Syllabus", "Opinion of the Court",
 *     "GORSUCH, J., concurring"); a change of running head is a change of writing
 *   - a paragraph opens with an indented line; a block quotation is indented throughout
 *   - part headings ("II", "A", "1", "a") are centred lines of their own
 *   - footnotes sit under a rule at the foot of the page, each opened by a raised number
 *   - italic type marks case names and emphasis
 *
 * What a decision adds to the shared shape:
 *   - `outcome`: the judgment, the holding, and each Justice's side, read from the syllabus's
 *     closing line-up.
 *   - `syllabus` (items, `disposition`, `lineup`) and `opinions`, each with its own `sections`
 *     and `footnotes`. A section is a printed part: `heading` ("1"), `path` (["II", "A", "1"]).
 *   - spans may be `footnote_ref` (zero length, with `number` and `target`).
 *   - items may have `align: "right"` ("It is so ordered.").
 *   - citations of type `case` (`reporter`, `volume`, `page`, `name`, `year`), with `mentions`
 *     counted per writing, so it can be seen which opinion relies on which authority.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const isoDate = text => {
  const m = /([A-Z][a-z]+) (\d{1,2}), ?(\d{4})/.exec(text ?? '');
  const month = m ? MONTHS.indexOf(m[1]) + 1 : 0;
  return month ? `${m[3]}-${String(month).padStart(2, '0')}-${m[2].padStart(2, '0')}` : null;
};

const titleCase = text => text.toLowerCase().replace(/(^|[\s.'’-])([a-z])/g, (_, a, b) => a + b.toUpperCase()).replace(/\bV\. /g, 'v. ');

const mode = values => {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];

// ---------------------------------------------------------------------------
// Lines → items. A line is appended to the open item or starts a new one.

/** Every word in the document, to tell a line-break hyphen from a real one (see joinLine). */
function vocabulary(pages) {
  const words = new Set();
  for (const page of pages) {
    for (const line of page.lines) {
      for (const [token] of line.text.matchAll(/[A-Za-z]+(?:-[A-Za-z]+)*/g)) {
        const parts = token.toLowerCase().split('-');
        parts.forEach((part, i) => {
          words.add(part);
          if (i > 0) words.add(`${parts[i - 1]}-${part}`);
        });
      }
    }
  }
  return words;
}

function joinLine(item, line, words) {
  if (!item.text) return;
  const left = /([A-Za-z]+)-?$/.exec(item.text)?.[1];
  const right = /^[A-Za-z]+/.exec(line.text)?.[0];
  const hyphenated = words.has(`${left}-${right}`.toLowerCase());
  const joined = words.has(`${left}${right}`.toLowerCase());
  if (item.soft) {
    // The line-break hyphen was dropped when the line was read. Where a compound happened
    // to break at its own hyphen ("quasi-" / "legislative"), put it back: the document
    // spells the word with a hyphen elsewhere and never without.
    if (left && right && hyphenated && !joined) item.text += '-';
    return;
  }
  if (left && right && item.text.endsWith('-')) {
    // A hyphen printed as part of the word is nearly always real ("in-house"), but a few
    // line-break hyphens are printed that way too ("Web-ster"). Drop it only when the
    // document spells the joined word elsewhere and never the hyphenated one.
    if (!hyphenated && joined) {
      item.text = item.text.slice(0, -1);
      for (const span of item.spans) span.end = Math.min(span.end, item.text.length);
    }
    return;
  }
  if (!/[—–-]$/.test(item.text)) item.text += ' ';
}

function appendLine(item, line, words) {
  joinLine(item, line, words);
  for (const run of line.runs) {
    // A raised figure inside brackets is part of the text: "[123I]ioflupane".
    if (run.sup && item.text.endsWith('[')) {
      item.text += run.text;
      continue;
    }
    if (run.sup) {
      const at = item.text.trimEnd().length;
      item.spans.push({ type: 'footnote_ref', start: at, end: at, number: run.text });
      continue;
    }
    const text = item.text ? run.text : run.text.trimStart();
    if (!text) continue;
    const start = item.text.length + (text.length - text.trimStart().length);
    item.text += text;
    const end = item.text.trimEnd().length;
    if (!run.italic || end <= start) continue;
    const prev = item.spans.at(-1);
    // Italics that run over a line break, or over a space set in roman, are one emphasis.
    if (prev?.type === 'emphasis' && !item.text.slice(prev.end, start).trim()) prev.end = end;
    else item.spans.push({ type: 'emphasis', start, end });
  }
  item.soft = line.softHyphen;
}

function finish(item) {
  delete item.soft;
  item.text = item.text.trimEnd();
  for (const span of item.spans) {
    span.end = Math.min(span.end, item.text.length);
    span.start = Math.min(span.start, span.end);
    if (span.type === 'emphasis') span.text = item.text.slice(span.start, span.end);
  }
  return item;
}

/**
 * @param lines   printed lines, each with `page` (the number printed on its page)
 * @param classify line → 'cont' | 'para' | 'quote' | 'right' | { heading }
 * @returns items, with `{ heading }` entries where a centred heading stood
 */
function buildItems(lines, classify, words) {
  const out = [];
  let item = null;
  let quoteX = null; // left edge of the block quotation being read
  const open = (line, extra) => {
    item = { marker: null, level: 0, page: line.page, text: '', spans: [], ...extra };
    out.push(item);
  };
  for (const line of lines) {
    const kind = classify(line);
    if (kind.heading) {
      out.push({ ...kind, pdf_page: line.pdfPage });
      item = null;
      continue;
    }
    if (kind === 'quote') {
      // The first line of a quoted paragraph may be indented further than the rest.
      if (!item?.quoted) open(line, { quoted: true, quote_level: 1 });
      else if (line.x > quoteX + 6) open(line, { quoted: true, quote_level: 1 });
      quoteX = item.text ? Math.min(quoteX, line.x) : line.x;
    } else if (kind === 'right') {
      open(line, { align: 'right' });
    } else if (!item || kind === 'para' || item.align) {
      open(line);
    } else if (item.quoted) {
      open(line, { continuation: true }); // the sentence resumes after a block quotation
    }
    appendLine(item, line, words);
  }
  return out.map(entry => (entry.heading ? entry : finish(entry)));
}

// ---------------------------------------------------------------------------
// Pages → writings (syllabus, opinion of the Court, concurrences, dissents)

const RULE = /^[—–_-]{4,}$/;

/** "BREYER, SOTOMAYOR, and KAGAN" → ["Breyer", "Sotomayor", "Kagan"] */
const namesIn = text => [...text.matchAll(/[A-Z][A-Z’']{2,}/g)].map(m => titleCase(m[0]));

function describeOne(head) {
  if (/^Syllabus$/i.test(head)) return { kind: 'syllabus' };
  if (/^Opinion of the Court$/i.test(head)) return { kind: 'majority', label: 'Opinion of the Court' };
  if (/^Per Curiam$/i.test(head)) return { kind: 'per_curiam', label: 'Per Curiam' };
  if (/^Appendix/i.test(head)) return { kind: 'appendix', label: head };
  let m = /^(Opinion|Statement) of (.+?), (C\. )?JJ?\.$/i.exec(head);
  if (m) {
    const authors = namesIn(m[2]);
    return { kind: m[1] === 'Statement' ? 'statement' : 'opinion', author: authors[0], authors, label: `${m[1]} of ${titleCase(m[2])}, ${m[3] ?? ''}J.` };
  }
  // "GORSUCH, J., concurring"; a joint writing: "BREYER, SOTOMAYOR, and KAGAN, JJ., dissenting"
  m = /^(.+?), (C\. )?(JJ?)\., (.+)$/.exec(head);
  if (m) {
    const what = m[4].toLowerCase();
    const kind = /concurring/.test(what) && /dissenting/.test(what) ? 'concurrence_in_part_dissent_in_part'
      : /dissenting/.test(what) ? 'dissent'
      : /concurring/.test(what) ? 'concurrence'
      : /statement/.test(what) ? 'statement'
      : 'opinion';
    const authors = namesIn(m[1]);
    return { kind, author: authors[0], authors, label: `${titleCase(m[1]).replace(/ And /g, ' and ')}, ${m[2] ?? ''}${m[3]}., ${what}` };
  }
  return { kind: 'other', label: head };
}

// Two running heads can be set on one line, and come out of the PDF run together: an
// appendix and the opinion it belongs to ("Appendix A to opinion of the CourtOpinion of the
// Court"), or the parts of a plurality opinion ("Opinion of KAGAN, J.Opinion of the Court").
function describeHead(head) {
  const parts = head.split(/(?<=[a-z.])(?=Opinion of |[A-Z]{3,}[ ,])/);
  if (parts.length === 1) return describeOne(head);
  const described = parts.map(describeOne);
  if (described[0].kind === 'appendix') return { ...described[0], label: parts[0] };
  return described.find(d => d.kind === 'majority') ?? described[0];
}

function splitWritings(pages) {
  const writings = [];
  for (const page of pages) {
    // The page head: the page number beside the citation or case name (which wraps when the
    // name is long), then the running head. The text starts well below it.
    const top = page.lines[0]?.y;
    const head = page.lines.filter(l => l.y >= top - 30);
    if (head.length < 2) continue;
    const headLine = head.at(-1);
    const numberLine = { ...head[0], text: head.slice(0, -1).map(l => l.text).join(' ') };
    const rest = page.lines.slice(head.length);
    const printed = Number(/^(\d+)\s/.exec(head[0].text)?.[1] ?? /\s(\d+)$/.exec(head[0].text)?.[1]);
    const captioned = rest.some(l => l.size >= 14);
    let writing = writings.at(-1);
    const described = describeHead(headLine.text);
    // A page with no running head (a picture, a map, an exhibit) belongs to the writing it
    // stands in, and what looked like the head is its first line.
    if (described.kind === 'other' && writing && !captioned) {
      writing.pages.push({ number: page.number, printed, numberLine, captioned, lines: [headLine, ...rest].map(l => ({ ...l, page: printed, pdfPage: page.number })) });
      continue;
    }
    // The parts of a plurality opinion alternate between "Opinion of the Court" and
    // "Opinion of KAGAN, J."; they are one writing.
    const lead = kind => kind === 'majority' || kind === 'opinion';
    const same = writing && (described.kind === writing.kind && described.author === writing.author
      || lead(described.kind) && lead(writing.kind) && (!described.author || !writing.author || described.author === writing.author));
    if (!writing || captioned || !same) {
      writings.push(writing = { head: headLine.text, ...described, pages: [] });
    } else if (described.kind === 'majority' && writing.kind === 'opinion') {
      Object.assign(writing, { kind: 'majority', label: 'Opinion of the Court' });
    }
    writing.pages.push({ number: page.number, printed, numberLine, captioned, lines: rest.map(l => ({ ...l, page: printed, pdfPage: page.number })) });
  }
  return writings;
}

/** The lines of a writing's pages, split into text and footnotes, without the caption block. */
function contentLines(writing, startsAfter) {
  const text = [];
  const notes = [];
  for (const page of writing.pages) {
    let lines = page.lines;
    if (page.captioned) lines = lines.slice(startsAfter(lines) + 1);
    const rule = lines.findIndex(l => RULE.test(l.text));
    text.push(...(rule === -1 ? lines : lines.slice(0, rule)));
    if (rule !== -1) notes.push(...lines.slice(rule + 1));
  }
  return { text, notes };
}

// ---------------------------------------------------------------------------
// Syllabus

// The judgment line and the line-up may be set flush with each other, so the line-up is
// found by how it starts: "ROBERTS, C. J., delivered…", "BREYER, SOTOMAYOR, and KAGAN, JJ., …",
// "PER CURIAM."
// (The comma after "J." is sometimes missing in print.)
const LINEUP_START = /(?:^|\s)((?:[A-Z][A-Z’']+(?:, and |, | and ))*[A-Z][A-Z’']+, (?:C\. )?JJ?\.,? (?:delivered|announced|filed)|PER CURIAM)/;
function splitClosing(items) {
  const text = items.map(i => i.text).join(' ');
  const at = text.search(LINEUP_START);
  // The judgment is the first paragraph after the holding, or the part of it before the line-up.
  const first = items[0]?.text ?? '';
  if (at === -1) return { disposition: first || null, lineup: null };
  const start = at + (/^\s/.test(text.slice(at)) ? 1 : 0);
  return { disposition: (start < first.length ? first.slice(0, start) : first).trim() || null, lineup: text.slice(start).trim() || null };
}

/** "Nos. 20–1199 and 21–707" → ["20-1199", "21-707"]; "No. 142, Orig." → ["142, Orig."] */
const docketsIn = text => [...(text ?? '').matchAll(/\d+, Orig\.?|\d+[–-]\d+|\d+A\d+/g)]
  .map(m => m[0].replace('–', '-').replace(/Orig$/, 'Orig.'));

function parseSyllabus(writing, words) {
  const first = writing.pages[0].lines;
  const court = first.findIndex(l => l.size >= 14);
  const docket = first.findIndex((l, i) => i > court && /^Nos?\. /.test(l.text));
  let decided = docket;
  while (decided < first.length - 1 && decided < docket + 3 && !/Decided/.test(first.slice(docket, decided + 1).map(l => l.text).join(' '))) decided++;
  const docketText = first.slice(docket, decided + 1).map(l => l.text).join(' ');

  const between = first.slice(court + 1, docket).filter(l => !/^Syllabus$/i.test(l.text));
  const captionSize = Math.max(...between.map(l => l.size));
  const head = {
    caption: between.filter(l => l.size === captionSize).map(l => l.text).join(' '),
    proceeding: between.filter(l => l.size < captionSize).map(l => l.text).join(' '),
    dockets: docketsIn(/^Nos?\. (.+?)\. Argued|^Nos?\. (.+?)\.\s/.exec(docketText)?.slice(1).find(Boolean) ?? docketText),
    argued_date: isoDate(/Argued ([^—]+)/.exec(docketText)?.[1]),
    decided_date: isoDate(/Decided (.+)$/.exec(docketText)?.[1]),
  };

  const { text } = contentLines(writing, () => decided);
  // Paragraphs here hang: every line but the first starts at the same left edge.
  const base = mode(text.map(l => Math.round(l.x)));
  // After the holding, the first line set out to the left is the judgment ("Reversed and
  // remanded."); what follows says who wrote and joined what, set as an ordinary paragraph.
  const held = text.findIndex(l => /^Held:/.test(l.text));
  let judgment = held === -1 ? -1 : text.findIndex((l, i) => i > held && l.x - base < -4);
  // No judgment line set out: the closing starts with the line-up itself.
  if (judgment === -1) judgment = text.findIndex((l, i) => i > held && LINEUP_START.test(` ${l.text}`) && LINEUP_START.exec(` ${l.text}`).index === 0);
  const body = buildItems(judgment === -1 ? text : text.slice(0, judgment),
    line => (Math.abs(line.x - base) < 4 ? 'cont' : 'para'), words);
  const closing = judgment === -1 ? [] : buildItems(text.slice(judgment),
    line => (line.x - text[judgment].x < 4 ? 'cont' : 'para'), words);

  // "(a) …" / "(1) …": the points of the holding, numbered as the opinion's parts are.
  let level = 0;
  let lastLetter = null;
  for (const item of body) {
    const m = /^\((\d+|[ivx]+|[a-z])\)\s+/.exec(item.text);
    if (m) {
      // (a), then (1), then (i). "(i)" is a letter only when it follows "(h)".
      const roman = /^[ivx]+$/.test(m[1]) && !(m[1] === 'i' && lastLetter === 'h') && level >= 2;
      item.marker = m[1];
      item.level = level = /\d/.test(m[1]) ? 2 : roman ? 3 : 1;
      if (level === 1) lastLetter = m[1];
      item.text = item.text.slice(m[0].length);
      item.spans = item.spans.map(s => ({ ...s, start: Math.max(0, s.start - m[0].length), end: Math.max(0, s.end - m[0].length) }));
    } else if (level > 0 && !/^Held:/.test(item.text)) {
      item.continuation = true;
      item.level = level;
    }
  }
  return {
    head,
    syllabus: {
      id: 'syllabus',
      label: 'Syllabus',
      pages: writing.pages.length,
      pdf_page: writing.pages[0].number,
      items: body,
      ...splitClosing(closing),
    },
  };
}

/**
 * Without a syllabus, the caption block heads the first opinion. Argued: docket, parties,
 * court below, "[date]". Not argued: parties, court below, "No. 19–1302. Decided <date>".
 */
function captionOf(writing) {
  const lines = writing?.pages[0]?.lines ?? [];
  const court = lines.findIndex(l => l.size >= 14);
  const docket = lines.findIndex((l, i) => i > court && /^Nos?\. /.test(l.text));
  if (court === -1 || docket === -1) return {};
  const dated = lines.findIndex((l, i) => i > docket && /^\[.*\d{4}\]$/.test(l.text));
  const decidedOnDocket = /Decided (.+)$/.exec(lines[docket].text);
  if (dated === -1 && !decidedOnDocket) return {};
  // A docket line can run on ("Nos. 20–1199 and 21–707").
  let after = docket + 1;
  while (after < lines.length && /^(and |\d+[–-]\d+)/.test(lines[after].text)) after++;
  const between = decidedOnDocket ? lines.slice(court + 1, docket) : lines.slice(after, dated);
  const captionSize = Math.max(...between.map(l => l.size));
  return {
    dockets: docketsIn(lines.slice(docket, after).map(l => l.text).join(' ').replace(/Decided .*$/, '')),
    caption: between.filter(l => l.size === captionSize).map(l => l.text).join(' '),
    proceeding: between.filter(l => l.size < captionSize).map(l => l.text).join(' '),
    decided_date: isoDate(decidedOnDocket ? decidedOnDocket[1] : lines[dated].text),
  };
}

// ---------------------------------------------------------------------------
// An opinion

function parseOpinion(writing, id, geometry, words) {
  const { base, right, centre } = geometry;
  // The caption ends with the date in brackets, or (a decision without argument) with
  // "No. 19–1302. Decided December 14, 2020".
  const { text, notes } = contentLines(writing, lines => {
    const dated = lines.findIndex(l => /^\[.*\d{4}\]$/.test(l.text));
    return dated !== -1 ? dated : lines.findIndex(l => /^Nos?\. .*Decided /.test(l.text));
  });

  const entries = buildItems(text, line => {
    const dx = line.x - base;
    const centred = dx > 30 && right - line.end > 30 && Math.abs((line.x + line.end) / 2 - centre) < 8;
    if (centred && /^([IVX]+|[A-Z]|\d{1,2}|[a-z]|\*( \*)*)$/.test(line.text)) return { heading: line.text };
    if (dx > 60 && right - line.end < 8) return 'right';
    if (dx < 4) return 'cont';
    return dx < 16 ? 'para' : 'quote';
  }, words);

  // Headings → sections. "II", then "A", then "1", then "a"; "* * *" sets off the conclusion.
  // `pdf_page`: where the part starts in the PDF file, for opening the printed page.
  const sections = [{ id, heading: null, path: [], level: 0, pdf_page: writing.pages[0].number, items: [] }];
  const used = new Set([id]);
  let romans = 0;
  let open = []; // the heading in force at each level: open[1] = "II", open[2] = "A", …
  for (const entry of entries) {
    if (!entry.heading) {
      sections.at(-1).items.push(entry);
      continue;
    }
    const t = entry.heading;
    // "I" and "V" are part numbers when they are the next one due, letters otherwise.
    const roman = /^[IVX]+$/.test(t) && (t === ROMAN[romans] || t.length > 1);
    const level = t.startsWith('*') || roman ? 1 : /^[A-Z]$/.test(t) ? 2 : /^\d/.test(t) ? 3 : 4;
    if (roman) romans++;
    open = t.startsWith('*') ? [] : open.slice(0, level);
    if (!t.startsWith('*')) open[level] = t;
    const path = open.filter(Boolean);
    let sectionId = `${id}-${path.length ? path.join('-') : 'end'}`;
    while (used.has(sectionId)) sectionId += '-2';
    used.add(sectionId);
    sections.push({ id: sectionId, heading: t, path, level, pdf_page: entry.pdf_page, items: [] });
  }

  // "JUSTICE SOTOMAYOR, with whom JUSTICE KAGAN and JUSTICE JACKSON join, dissenting."
  let byline = null;
  let bylineRef = null; // a note on the byline itself ("JUSTICE THOMAS, concurring.*"), often on who joined
  const opening = sections[0].items[0];
  if (opening && /^((THE )?CHIEF JUSTICE|JUSTICE [A-Z]|PER CURIAM)/.test(opening.text)) {
    const item = sections[0].items.shift();
    byline = item.text;
    bylineRef = item.spans.find(s => s.type === 'footnote_ref')?.number ?? null;
    // or set in the line: "JUSTICE THOMAS, concurring.*"
    const inline = /([*†‡])$/.exec(byline);
    if (!bylineRef && inline) {
      bylineRef = inline[1];
      byline = byline.slice(0, -1).trimEnd();
    }
  }
  const justices = [...(byline ?? '').matchAll(/(?:CHIEF JUSTICE|JUSTICE) ([A-Z][A-Z’']+)/g)].map(m => titleCase(m[1]));

  // Footnotes: a raised number opens one; text under the rule before any number carries on
  // the last footnote of the page before.
  const footnotes = [];
  for (const line of notes) {
    let mark = line.runs[0]?.sup ? line.runs[0].text : null;
    let runs = line.runs.slice(mark ? 1 : 0);
    // An asterisk note can be set on the line instead of raised: "*Justice Scalia’s …"
    if (!mark && line.x - base > 4 && line.x - base < 16 && /^[*†‡]/.test(line.text) && !footnotes.some(n => n.number === line.text[0])) {
      mark = line.text[0];
      runs = [{ ...line.runs[0], text: line.runs[0].text.slice(1) }, ...line.runs.slice(1)];
    }
    if (mark) footnotes.push({ number: mark, id: `${id}-fn-${mark}`, lines: [] });
    if (!footnotes.length) continue;
    footnotes.at(-1).lines.push(mark ? { ...line, runs, opens: true } : line);
  }
  for (const note of footnotes) {
    note.items = buildItems(note.lines, line => {
      const dx = line.x - base;
      if (line.opens) return 'para';
      if (dx < 4) return 'cont';
      return dx < 16 ? 'para' : 'quote';
    }, words);
    delete note.lines;
  }
  // An asterisk note is often called by an asterisk set in the line, not raised: make the
  // first one after a word or closing mark its call.
  const called = new Set(sections.flatMap(sec => sec.items.flatMap(i => i.spans.filter(sp => sp.type === 'footnote_ref').map(sp => sp.number))));
  for (const note of footnotes.filter(n => /^[*†‡]$/.test(n.number) && !called.has(n.number))) {
    for (const item of sections.flatMap(sec => sec.items)) {
      const at = item.text.search(new RegExp(`(?<=[\\w.,;:”’)\\]])\\${note.number}(?=\\s|$)`));
      if (at === -1) continue;
      item.text = item.text.slice(0, at) + item.text.slice(at + 1);
      for (const span of item.spans) {
        if (span.start > at) span.start--;
        if (span.end > at) span.end--;
      }
      item.spans.push({ type: 'footnote_ref', start: at, end: at, number: note.number });
      item.spans.sort((a, b) => a.start - b.start || a.end - b.end);
      break;
    }
  }
  for (const section of sections) {
    for (const item of section.items) {
      for (const span of item.spans) if (span.type === 'footnote_ref') span.target = `${id}-fn-${span.number}`;
    }
  }

  return {
    id,
    kind: writing.kind,
    label: writing.label,
    author: writing.author ?? (/^(CHIEF )?JUSTICE/.test(byline ?? '') ? justices[0] : null) ?? null,
    joined_by: writing.kind === 'majority' ? [] : justices.slice(1),
    byline,
    ...(bylineRef && { byline_ref: { number: bylineRef, target: `${id}-fn-${bylineRef}` } }),
    pages: writing.pages.length,
    pdf_page: writing.pages[0].number,
    // An opinion with no headings is one unheaded section; one that opens with text before
    // "I" keeps that text as an unheaded first section.
    sections: sections.filter((s, i) => i > 0 || s.items.length > 0 || sections.length === 1),
    footnotes,
  };
}

// ---------------------------------------------------------------------------
// Outcome: the judgment, and how each Justice voted. The syllabus closes with a line-up in
// a fixed form: "ROBERTS, C. J., delivered the opinion of the Court, in which ALITO, …, JJ.,
// joined, and in which THOMAS, J., joined as to all but Part III–B. GORSUCH, J., filed a
// concurring opinion. SOTOMAYOR, J., filed a dissenting opinion, in which KAGAN and JACKSON,
// JJ., joined."

const JUSTICE = "[A-Z][A-Z’']+";
// Capitalised words in a line-up that are not names.
const NOT_NAMES = new Set(['JJ', 'PART', 'PARTS']);

const kindOf = action =>
  /announced the judgment/.test(action) ? 'plurality'
    : /delivered the opinion|opinion for a unanimous/.test(action) ? 'majority'
    : /took no part/.test(action) ? 'recused'
    : /concurring/.test(action) && /dissenting/.test(action) ? 'concurrence_in_part_dissent_in_part'
    : /dissent/.test(action) ? 'dissent'
    : /concurring/.test(action) ? 'concurrence'
    : 'other';

// Which way each Justice went. Joining or writing the Court's opinion, or concurring, is a
// vote for the judgment; the first thing said about a Justice decides.
const SIDE = { majority: 'majority', plurality: 'majority', per_curiam: 'majority', concurrence: 'majority', dissent: 'dissent', concurrence_in_part_dissent_in_part: 'mixed', recused: 'none', other: null };

/** The line-up's sentences → [{ author, chief?, kind, action, joined: [{ justice, qualifier? }], all_others? }] */
function lineupWritings(lineup, members = []) {
  const writings = [];
  const authors = `(?:${JUSTICE}(?:, and |, | and ))*${JUSTICE}`;
  // "ROB-" / "ERTS", "Mem-" / "bers": a word broken over a line can keep its hyphen. The
  // line-up has no hyphenated words of its own (part ranges use an en dash).
  const text = lineup.replace(/([A-Za-z])- ?([A-Za-z])/g, '$1$2');
  const isMember = name => !members.length || members.includes(name);
  for (const sentence of text.split(new RegExp(`(?<=\\.) (?=${authors}, (?:C\\. )?JJ?\\.,? )`))) {
    const m = new RegExp(`^(${authors}), (C\\. )?JJ?\\.,? (.*)$`).exec(sentence);
    if (!m) continue;
    const [, names, chief, rest] = m;
    // "ROBERTS, C. J., and KAVANAUGH and BARRETT, JJ., joined that opinion in full, and
    // THOMAS, J., joined except for Part II–C." — joiners of the writing named before.
    if (/^(and |joined)/.test(rest)) {
      const target = writings.findLast(w => ['majority', 'plurality'].includes(w.kind)) ?? writings.at(-1);
      if (!target) continue;
      const pieces = sentence.split(/joined(?: that opinion)?(?: (in full|except [^,.;]+|as to [^,.;]+))?/);
      for (let i = 0; i + 1 < pieces.length; i += 2) {
        const qualifier = pieces[i + 1] && pieces[i + 1] !== 'in full' ? pieces[i + 1].trim() : null;
        for (const name of namesIn(pieces[i]).filter(isMember)) {
          target.joined.push({ justice: name, ...(qualifier && { qualifier }) });
        }
      }
      continue;
    }
    const [author, ...coauthors] = namesIn(names).filter(isMember);
    if (!author) continue;
    const [actionPart, ...clauses] = rest.split(/[,;]? (?:and )?in which /);
    const writing = { author, ...(chief && { chief: true }), action: actionPart.replace(/\.$/, ''), joined: coauthors.map(justice => ({ justice })) };
    writing.kind = kindOf(writing.action);
    if (/for a unanimous Court/.test(writing.action)) writing.all_others = true;
    for (const clause of clauses) {
      // "ROBERTS, C. J., and ALITO, GORSUCH, and BARRETT, JJ., joined as to Parts I and II"
      const j = /^(.*?),? joined(?: ((?:except |as to |in )[^,;]*?))?(?:,|;|\.|$)/.exec(clause);
      if (!j) continue;
      if (/all other Members/.test(j[1])) { writing.all_others = true; continue; }
      for (const [name] of j[1].matchAll(new RegExp(`\\b${JUSTICE}\\b`, 'g'))) {
        if (name.length < 3 || NOT_NAMES.has(name) || !isMember(titleCase(name))) continue;
        writing.joined.push({ justice: titleCase(name), ...(j[2] && { qualifier: j[2].trim() }) });
      }
    }
    writings.push(writing);
    // "…in which all other Members joined, except BARRETT, J., who took no part…"
    for (const [, name] of rest.matchAll(new RegExp(`(${JUSTICE}), (?:C\\. )?J\\., who took no part`, 'g'))) {
      writings.push({ author: titleCase(name), kind: 'recused', action: 'took no part', joined: [] });
    }
  }
  return writings;
}

/** A per curiam decision has no line-up; its separate writings name their authors and joiners. */
function perCuriamWritings(opinions, members) {
  const chief = members[0];
  const named = byline => [...(byline ?? '').matchAll(/THE CHIEF JUSTICE|(?:CHIEF )?JUSTICE ([A-Z][A-Z’']+)/g)]
    .map(m => (m[1] ? titleCase(m[1]) : chief)).filter(Boolean);
  return opinions.filter(o => o.kind !== 'per_curiam').map(o => {
    const [author, ...joined] = named(o.byline);
    return { author: author ?? o.author, kind: o.kind, action: o.label, opinion: o.id, joined: joined.map(justice => ({ justice })) };
  });
}

function parseOutcome(syllabus, opinions, members = []) {
  const perCuriam = opinions.find(o => o.kind === 'per_curiam');
  if (!syllabus?.lineup && !perCuriam) return null;
  const writings = syllabus?.lineup ? lineupWritings(syllabus.lineup, members) : perCuriamWritings(opinions, members);
  if (perCuriam && !writings.some(w => w.kind === 'majority')) {
    writings.unshift({ author: null, kind: 'per_curiam', action: 'Per curiam', opinion: perCuriam.id, joined: [], all_others: true });
  }
  for (const w of writings) {
    w.opinion ??= w.kind === 'recused' ? null
      : (opinions.find(o => o.kind === w.kind && (['majority', 'per_curiam'].includes(w.kind) || o.author === w.author))
        // A plurality's lead opinion is headed "Opinion of the Court" for the parts a majority joined.
        ?? (w.kind === 'plurality' ? opinions.find(o => ['majority', 'opinion'].includes(o.kind) && (!o.author || o.author === w.author)) : null)
        ?? opinions.find(o => o.author === w.author && !['majority', 'appendix'].includes(o.kind)))?.id ?? null;
  }

  const justices = [];
  const justice = name => {
    let j = justices.find(x => x.name === name);
    if (!j) justices.push(j = { name, side: null, wrote: [], joined: [] });
    return j;
  };
  for (const w of writings) {
    if (!w.author) continue;
    const author = justice(w.author);
    if (w.chief) author.chief = true;
    author.side ??= SIDE[w.kind];
    if (w.opinion) author.wrote.push(w.opinion);
    for (const join of w.joined) {
      const j = justice(join.justice);
      j.side ??= SIDE[w.kind];
      j.joined.push({ opinion: w.opinion, ...(join.qualifier && { qualifier: join.qualifier }) });
    }
  }
  // "for a unanimous Court", "in which all other Members joined", or a per curiam: every
  // sitting member not otherwise accounted for, from the Court's membership on that date.
  const recused = new Set(writings.filter(w => w.kind === 'recused').map(w => w.author));
  for (const w of writings.filter(w => w.all_others)) {
    for (const name of members) {
      if (name === w.author || recused.has(name)) continue;
      const j = justice(name);
      if (j.side && w.kind === 'per_curiam') continue; // already placed by a separate writing
      j.side ??= SIDE[w.kind];
      j.joined.push({ opinion: w.opinion });
      w.joined.push({ justice: name });
    }
  }
  if (members[0] && justices.some(j => j.name === members[0])) justice(members[0]).chief = true;
  // In the order the Court lists its members: the Chief Justice, then by seniority.
  if (members.length) justices.sort((a, b) => (members.indexOf(a.name) + 1 || 99) - (members.indexOf(b.name) + 1 || 99));

  const count = side => justices.filter(j => j.side === side).length;
  return {
    disposition: syllabus?.disposition ?? null,
    holding: syllabus?.items.find(i => /^Held:/.test(i.text))?.text ?? null,
    vote: { majority: count('majority'), dissent: count('dissent'), ...(count('mixed') && { mixed: count('mixed') }) },
    // A per curiam does not say who joined it: everyone not writing separately is counted with it.
    ...(!syllabus?.lineup && { inferred: true }),
    justices,
    writings,
  };
}

// ---------------------------------------------------------------------------
// Citations. The Court's citation forms are fixed (its own style manual), so the ones that
// name a volume and page can be found by pattern and linked.

const CASE_REPORTERS = {
  'U. S.': 'U.S.', 'S. Ct.': 'S. Ct.',
  'F. 2d': 'F.2d', 'F. 3d': 'F.3d', 'F. 4th': 'F.4th',
  'F. Supp.': 'F. Supp.', 'F. Supp. 2d': 'F. Supp. 2d', 'F. Supp. 3d': 'F. Supp. 3d',
  // The early volumes of the U.S. Reports are cited by their reporter's name.
  'Dall.': 'Dall.', 'Cranch': 'Cranch', 'Wheat.': 'Wheat.', 'Pet.': 'Pet.', 'How.': 'How.', 'Black': 'Black', 'Wall.': 'Wall.',
};
const REPORTER = 'U\\. S\\.|S\\. Ct\\.|F\\. (?:2d|3d|4th)|F\\. Supp\\.(?: 2d| 3d)?|Dall\\.|Cranch|Wheat\\.|Pet\\.|How\\.|Black|Wall\\.';

const caseHref = (reporter, volume, page) =>
  `https://www.courtlistener.com/c/${encodeURIComponent(CASE_REPORTERS[reporter])}/${volume}/${page}/`;

/** The italic case name that ends just before `at`: "Myers v. United States" before ", 272 U. S. 52". */
function nameBefore(item, at) {
  const emphasis = item.spans.filter(s => s.type === 'emphasis' && s.end <= at);
  let i = emphasis.length - 1;
  if (i < 0 || !/^[,.]?\s*$/.test(item.text.slice(emphasis[i].end, at))) return null;
  const end = emphasis[i].end;
  // "v." between the parties is set in roman, as is the period of "ex rel.".
  while (i > 0 && /^\s*(v\.|ex rel\.|\.)\s*$/.test(item.text.slice(emphasis[i - 1].end, emphasis[i].start))) i--;
  const name = item.text.slice(emphasis[i].start, end).replace(/[,\s]+$/, '');
  return /^(id|ibid|supra|infra|see|e\.g|cf|accord|post|ante)\b/i.test(name) ? null : name;
}

function findCitations(blocks) {
  const citations = new Map();
  const mention = (key, fields, label, block) => {
    let c = citations.get(key);
    if (!c) citations.set(key, c = { ...fields, labels: [], cited_in: [], mentions: {} });
    if (label && !c.labels.includes(label)) c.labels.push(label);
    if (!c.cited_in.includes(block.section)) c.cited_in.push(block.section);
    c.mentions[block.writing] = (c.mentions[block.writing] ?? 0) + 1;
    return c;
  };
  const link = (item, m, target, href) => {
    item.spans.push({ type: 'citation', start: m.index, end: m.index + m[0].length, text: m[0], target, href });
  };

  // Cases cited in full: "272 U. S. 52 (1926)".
  const full = new RegExp(`\\b(\\d{1,4}) (${REPORTER}) (\\d{1,4})\\b`, 'g');
  for (const block of blocks) {
    for (const item of block.items) {
      for (const m of item.text.matchAll(full)) {
        const [text, volume, reporter, page] = m;
        const target = { type: 'case', reporter, volume: Number(volume), page: Number(page) };
        const href = caseHref(reporter, volume, page);
        const c = mention(`case:${reporter}:${volume}:${page}`, { ...target, href }, null, block);
        c.name ??= nameBefore(item, m.index) ?? undefined;
        // "(1926)", possibly after pin pages: ", 163–164 (1926)"
        c.year ??= Number(/^(?:,[^()]{1,40})? \((?:[A-Za-z0-9. ]+ )?(\d{4})\)/.exec(item.text.slice(m.index + text.length))?.[1]) || undefined;
        link(item, m, target, href);
      }
    }
  }
  for (const c of citations.values()) {
    const cite = `${c.volume} ${c.reporter} ${c.page}`;
    c.labels.push([c.name, cite].filter(Boolean).join(', ') + (c.year ? ` (${c.year})` : ''));
  }

  // Later references give only the volume and the page relied on: "272 U. S., at 164".
  // That page lies in the case that starts nearest before it, among those cited in full.
  const short = new RegExp(`\\b(\\d{1,4}) (${REPORTER}), at (\\d+)`, 'g');
  const cases = [...citations.values()];
  for (const block of blocks) {
    for (const item of block.items) {
      for (const m of item.text.matchAll(short)) {
        const [, volume, reporter, pin] = m;
        const c = cases
          .filter(c => c.reporter === reporter && c.volume === Number(volume) && c.page <= Number(pin))
          .sort((a, b) => b.page - a.page)[0];
        if (!c) continue;
        mention(`case:${c.reporter}:${c.volume}:${c.page}`, {}, null, block);
        link(item, { index: m.index, 0: `${volume} ${reporter}` }, { type: 'case', reporter: c.reporter, volume: c.volume, page: c.page }, c.href);
      }
    }
  }

  // Decisions too recent to have a page: "605 U. S. ___ (2025)". Listed, but there is no
  // page to link to.
  for (const block of blocks) {
    for (const item of block.items) {
      for (const m of item.text.matchAll(/\b(\d{1,3}) U\. S\. _+(?:, _+)?(?:,? \([^)]*\))*/g)) {
        const name = nameBefore(item, m.index);
        if (!name) continue;
        const year = Number(/\((\d{4})\)/.exec(m[0])?.[1]) || undefined;
        mention(`case:slip:${m[1]}:${name}`, { type: 'case', reporter: 'U. S.', volume: Number(m[1]), page: null, name, year, href: null },
          `${name}, ${m[1]} U. S. ___${year ? ` (${year})` : ''}`, block);
      }
    }
  }

  const statutes = [
    // "§2000e–5" is one section; "§§7171–7172" is a range, linked at its first section.
    [/\b(\d{1,2}) U\. S\. C\. (?:§ ?(\d+[a-z]*(?:–\d+[a-z]*)?)|§§ ?(\d+[a-z]*))/g,
      m => ({ type: 'usc', title: m[1], section: (m[2] ?? m[3]).replace('–', '-') }),
      t => `https://www.govinfo.gov/link/uscode/${t.title}/${t.section}`, m => `${m[1]} U. S. C. §${m[2] ?? m[3]}`],
    [/\b(\d{1,3}) Stat\. (\d+)/g, m => ({ type: 'statute', volume: Number(m[1]), page: Number(m[2]) }),
      t => `https://www.govinfo.gov/link/statute/${t.volume}/${t.page}`, m => m[0]],
    [/\b(\d{1,3}) Fed\. Reg\. (\d+)/g, m => ({ type: 'federal_register', volume: Number(m[1]), page: Number(m[2]) }),
      t => `https://www.federalregister.gov/citation/${t.volume}-FR-${t.page}`, m => m[0]],
  ];
  for (const block of blocks) {
    for (const item of block.items) {
      for (const [pattern, toTarget, toHref, toLabel] of statutes) {
        for (const m of item.text.matchAll(pattern)) {
          const target = toTarget(m);
          const href = toHref(target);
          mention(href, { ...target, href }, toLabel(m), block);
          link(item, m, target, href);
        }
      }
      item.spans.sort((a, b) => a.start - b.start || a.end - b.end);
    }
  }
  return [...citations.values()];
}

// ---------------------------------------------------------------------------

/**
 * @param pages printed lines, from extractPdfLines()
 * @param meta  { case_name, pdf_url, members, … } — what the PDF itself does not say reliably.
 *              `members`: the Justices' surnames, Chief Justice first, to expand "for a
 *              unanimous Court" and to count a per curiam.
 */
export function parseSlipOpinion(pages, meta = {}) {
  const words = vocabulary(pages);
  const writings = splitWritings(pages);
  const syllabusWriting = writings.find(w => w.kind === 'syllabus');
  const opinionWritings = writings.filter(w => w.kind !== 'syllabus');

  // Left edge, right edge and centre of the text column, from the opinions' own lines.
  const lines = opinionWritings.flatMap(w => w.pages.flatMap(p => p.lines));
  const bodySize = mode(lines.map(l => l.size));
  const bodyLines = lines.filter(l => l.size === bodySize);
  const base = mode(bodyLines.map(l => Math.round(l.x)));
  const right = Math.max(...bodyLines.map(l => l.end).sort((a, b) => a - b).slice(0, Math.ceil(bodyLines.length * 0.98)));
  const geometry = { base, right, centre: (base + right) / 2 };

  const { head, syllabus } = syllabusWriting ? parseSyllabus(syllabusWriting, words) : { head: captionOf(opinionWritings[0]), syllabus: null };

  const ids = new Set();
  const opinions = opinionWritings.map(writing => {
    let id = [writing.kind.replace(/_/g, '-'), writing.author?.toLowerCase().replace(/[^a-z]/g, '')]
      .filter((part, i) => part && (i === 0 || !['majority', 'per_curiam'].includes(writing.kind))).join('-');
    while (ids.has(id)) id += '-2';
    ids.add(id);
    const opinion = parseOpinion(writing, id, geometry, words);
    // "JUSTICE KAGAN announced the judgment of the Court and delivered an opinion…"
    if (/announced the judgment of the Court/.test(opinion.byline ?? '')) opinion.kind = 'plurality';
    if (writing.authors?.length > 1) opinion.authors = writing.authors;
    return opinion;
  });

  const blocks = [
    ...(syllabus ? [{ writing: 'syllabus', section: 'syllabus', items: syllabus.items }] : []),
    ...opinions.flatMap(opinion => [
      ...opinion.sections.map(s => ({ writing: opinion.id, section: s.id, items: s.items })),
      ...opinion.footnotes.map(n => ({ writing: opinion.id, section: n.id, items: n.items })),
    ]),
  ];
  const citations = findCitations(blocks);

  const firstPage = pages[0]?.lines[0]?.text ?? '';
  const runningName = writings.flatMap(w => w.pages).map(p => /^\d+\s+(.+ v\. .+)$/.exec(p.numberLine.text)?.[1]).find(Boolean);
  const cite = writings.flatMap(w => w.pages).map(p => /Cite as: (.+?\(\d{4}\))/.exec(p.numberLine.text)?.[1]).find(Boolean);

  return {
    doc_type: 'court_opinion',
    court: 'scotus',
    case_name: meta.case_name ?? (runningName ? titleCase(runningName) : null),
    caption: head.caption ?? null,
    proceeding: head.proceeding ?? null,
    docket_number: head.dockets?.[0] ?? null,
    ...(head.dockets?.length > 1 && { docket_numbers: head.dockets }),
    term: /OCTOBER TERM, \d{4}/.test(firstPage) ? titleCase(/OCTOBER TERM, \d{4}/.exec(firstPage)[0]) : null,
    argued_date: head.argued_date ?? null,
    decided_date: head.decided_date ?? null,
    // Until the bound volume is printed the page is a blank: "609 U. S. ___ (2026)".
    citation: cite?.replace(/_+/, '___') ?? null,
    source: { name: 'supremecourt.gov', kind: 'slip_opinion', pdf_url: meta.pdf_url ?? null, pages: pages.length, ...meta.source },
    outcome: parseOutcome(syllabus, opinions, meta.members),
    syllabus,
    opinions,
    citations,
  };
}

/**
 * What looks wrong in a parsed decision, as short messages; empty when nothing does. The
 * structure is inferred from the typesetting, so every decision loaded in bulk is checked.
 */
export function checkDecision(parsed) {
  const problems = [];
  const items = opinion => opinion.sections.flatMap(s => s.items);
  if (!parsed.opinions.length) problems.push('no opinions found');
  if (!parsed.docket_number) problems.push('no docket number');
  if (!parsed.decided_date) problems.push('no decision date');
  for (const opinion of parsed.opinions) {
    if (!items(opinion).length) problems.push(`${opinion.id}: no text`);
    if (opinion.kind === 'other') problems.push(`${opinion.id}: running head not recognised ("${opinion.label}")`);
    const calls = [
      ...(opinion.byline_ref ? [opinion.byline_ref.number] : []),
      ...items(opinion).flatMap(i => i.spans.filter(s => s.type === 'footnote_ref').map(s => s.number)),
    ];
    const notes = opinion.footnotes.map(n => n.number);
    if (calls.join() !== notes.join()) problems.push(`${opinion.id}: footnote calls [${calls}] do not match footnotes [${notes}]`);
  }
  if (parsed.syllabus) {
    if (!parsed.outcome) problems.push('syllabus without a line-up');
    else {
      const { majority, dissent, mixed = 0 } = parsed.outcome.vote;
      const sitting = parsed.outcome.justices.filter(j => j.side !== 'none').length;
      if (sitting < 7 || sitting > 9 || majority + dissent + mixed !== sitting) {
        problems.push(`outcome counts ${sitting} Justices (${majority}–${dissent}${mixed ? `, ${mixed} in part` : ''})`);
      }
      const unmatched = parsed.outcome.writings.filter(w => w.kind !== 'recused' && !w.opinion);
      if (unmatched.length) problems.push(`line-up names writings not found: ${unmatched.map(w => `${w.author} (${w.kind})`).join(', ')}`);
    }
  }
  return problems;
}
