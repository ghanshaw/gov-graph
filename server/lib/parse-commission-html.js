// The 9/11 Commission's HTML edition (9-11commission.gov/report, 2004) → the shared shape: a part
// (chapter, preface, appendix) is sections → items with spans, and its endnotes are footnotes.
//
// The files are hand-written HTML 4 in windows-1252, with unclosed <p>s and the page's navigation
// around the text. What the markup gives:
//   <h2>        the part's title (a later <h2> in the same part is a section, as in the summary)
//   <h4>        a numbered section, "1.1 INSIDE THE FOUR FLIGHTS"
//   <p><strong>Heading</strong><br>       a heading on its own line
//   <p><strong>Run-in heading</strong>. Text…   a heading that opens a paragraph
//   <p><strong>Recommendation: …</strong>       one of the Commission's recommendations
//   <sup>12</sup>  a note call; the notes are in their own file, grouped by chapter
//   <ul><li>, <blockquote>, <table> (the appendices)
// The text is kept as printed in the HTML, including its slips (hyphens for dashes, a missing space
// after some full stops).

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', eacute: 'é', ouml: 'ö', uuml: 'ü', aacute: 'á', iacute: 'í', oacute: 'ó', ntilde: 'ñ' };
const decode = text => text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
  return ENTITIES[e.toLowerCase()] ?? m;
});

/** A downloaded file's bytes → text (the files are windows-1252, not marked as such). */
export const decodeFile = buffer => new TextDecoder('windows-1252').decode(buffer);

/** The text column of a page: from its first <h2> to the side navigation. */
export function contentOf(html) {
  const start = html.search(/<h2\b/i);
  const end = html.search(/<!--\s*SideNav\s*-->/i);
  if (start === -1) throw new Error('no <h2> in the page');
  return html.slice(start, end === -1 ? undefined : end);
}

// ---------------------------------------------------------------------------
// Blocks: each paragraph, heading, list item or table, as runs of text with their styling.

/**
 * Tables that are boxes: the report sets its sidebars ("Flights of Saudi Nationals Leaving the United
 * States") as a one-column table of paragraphs. → Set of the offsets of their opening tags.
 */
function boxTables(html) {
  const boxes = new Set();
  const stack = [];
  for (const m of html.matchAll(/<(\/?)table\b[^>]*>/gi)) {
    if (!m[1]) {
      stack.push(m.index);
      continue;
    }
    const start = stack.pop();
    if (start === undefined || stack.length) continue; // only outermost tables
    const inner = html.slice(start, m.index);
    const widest = Math.max(0, ...inner.split(/<tr\b/i).map(row => (row.match(/<td\b/gi) ?? []).length));
    if (widest <= 1 && /<p\b/i.test(inner)) boxes.add(start);
  }
  return boxes;
}

/** HTML → [{ tag: 'h2' | 'h4' | 'p' | 'li' | 'table', quote, box, runs: [{ text, strong, em, sup }], rows }] */
export function readBlocks(html) {
  const boxes = boxTables(html);
  let box = 0; // the number of the box being read, 0 outside one
  let boxCount = 0;
  let boxDepth = 0; // tables nested in a box
  const blocks = [];
  let block = null;
  let heading = null; // 'h2' | 'h4' while one is open: a <p> inside it is a line break
  let quote = 0;
  let table = null;
  let cell = null;
  let tableDepth = 0;
  const endCell = () => {
    if (!cell) return;
    if (!table.rows.length) table.rows.push([]);
    table.rows.at(-1).push(cell.join('').replace(/\s+/g, ' ').trim());
    cell = null;
  };
  const style = { strong: 0, em: 0, sup: 0 };

  const close = () => {
    if (block && block.runs.some(r => r.text.trim() || r.sup)) blocks.push(block);
    block = null;
  };
  const open = tag => {
    close();
    block = { tag, quote, box, runs: [] };
  };
  const add = text => {
    if (cell) {
      cell.push(text);
      return;
    }
    if (!block) {
      if (!text.trim()) return;
      open('p');
    }
    block.runs.push({ text, strong: style.strong > 0, em: style.em > 0, sup: style.sup > 0 });
  };

  for (const m of html.matchAll(/<!--[\s\S]*?-->|<(\/?)([a-z][a-z0-9]*)\b[^>]*>|([^<]+)/gi)) {
    if (m[3] !== undefined) {
      add(decode(m[3]));
      continue;
    }
    if (!m[2]) continue; // a comment
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    switch (tag) {
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5':
        if (closing) {
          close();
          heading = null;
        } else {
          open(tag === 'h2' || tag === 'h1' ? 'h2' : 'h4');
          heading = tag;
        }
        break;
      case 'p': case 'div':
        if (heading) add('\n');
        else if (!closing) open('p');
        else close();
        break;
      case 'br':
        add('\n');
        break;
      case 'li':
        if (closing) close();
        else open('li');
        break;
      case 'ul': case 'ol':
        close();
        break;
      case 'blockquote':
        close();
        quote += closing ? -1 : 1;
        break;
      case 'strong': case 'b':
        style.strong += closing ? -1 : 1;
        break;
      case 'em': case 'i':
        style.em += closing ? -1 : 1;
        break;
      case 'sup':
        style.sup += closing ? -1 : 1;
        break;
      case 'table':
        if (!closing && boxes.has(m.index)) {
          close();
          box = ++boxCount;
          boxDepth = 1;
          break;
        }
        if (box) {
          // A box's own table tags (and any inside it) only frame its paragraphs.
          boxDepth += closing ? -1 : 1;
          if (boxDepth === 0) {
            close();
            box = 0;
          }
          break;
        }
        // The flight timelines in chapter 1 are tables inside a table; only the outermost counts.
        endCell();
        if (closing) {
          if (--tableDepth > 0) break;
          if (table?.rows.length) blocks.push(table);
          table = null;
        } else if (tableDepth++ === 0) {
          close();
          table = { tag: 'table', quote, box, rows: [] };
        }
        break;
      case 'tr':
        if (box) break;
        endCell();
        if (!closing && table) table.rows.push([]);
        break;
      case 'td': case 'th':
        if (box) break;
        // Cells are not always closed: a new one, a new row or the table's end closes them.
        endCell();
        if (!closing && table) cell = [];
        break;
      default:
        break;
    }
  }
  close();
  for (const s of Object.keys(style)) style[s] = Math.max(0, style[s]);
  return blocks;
}

// ---------------------------------------------------------------------------
// Runs → text and spans.

/**
 * Runs → { text, spans }: whitespace collapsed, note calls as zero-length spans
 * (`noteId(number)` names their target), emphasis and bold as spans. Line breaks are kept as '\n'
 * so a heading on its own line can be split off.
 */
function flatten(runs, noteId) {
  let text = '';
  const spans = [];
  const push = (piece, run) => {
    piece = piece.replace(/[ \t\r\f\v\u00a0]+/g, ' ').replace(/ *\n[ \n]*/g, '\n');
    if (/[ \n]$/.test(text) || !text) piece = piece.replace(/^ /, '');
    if (text.endsWith('\n')) piece = piece.replace(/^\n+/, '');
    if (!piece) return;
    const start = text.length;
    text += piece;
    if (run.em) spans.push({ type: 'emphasis', start, end: text.length });
    if (run.strong) spans.push({ type: 'strong', start, end: text.length });
  };
  for (const run of runs) {
    if (run.sup) {
      const number = run.text.trim();
      if (/^\d+$/.test(number)) {
        if (text.endsWith(' ')) text = text.slice(0, -1);
        spans.push({ type: 'footnote_ref', start: text.length, end: text.length, number, target: noteId(number) });
        continue;
      }
    }
    push(run.text, run);
  }
  // Trim, moving the spans with the text.
  const lead = text.length - text.replace(/^\s+/, '').length;
  text = text.trim();
  const fixed = spans
    .map(s => ({ ...s, start: Math.max(0, s.start - lead), end: Math.min(text.length, Math.max(0, s.end - lead)) }))
    .filter(s => s.type === 'footnote_ref' || s.end > s.start);
  return { text, spans: mergeSpans(fixed) };
}

/** Adjacent spans of the same styling become one. */
function mergeSpans(spans) {
  const out = [];
  for (const s of spans) {
    const prev = out.findLast(p => p.type === s.type);
    if (prev && s.type !== 'footnote_ref' && prev.end >= s.start - 1 && prev.end <= s.start) prev.end = s.end;
    else out.push({ ...s });
  }
  return out.sort((a, b) => a.start - b.start || (a.type === 'footnote_ref' ? -1 : 1));
}

/** The part of a text from `from` on, with its spans shifted. */
function slice({ text, spans }, from, to = text.length) {
  const piece = text.slice(from, to);
  const lead = piece.length - piece.trimStart().length;
  const start = from + lead;
  const out = piece.trim();
  return {
    text: out,
    spans: spans
      .filter(s => (s.type === 'footnote_ref' ? s.start >= start && s.start <= start + out.length : s.end > start && s.start < start + out.length))
      .map(s => ({ ...s, start: Math.max(0, s.start - start), end: Math.min(out.length, Math.max(0, s.end - start)) })),
  };
}

const plain = (text, spans) => ({ text, spans: spans.filter(s => !(s.type === 'strong' && s.start === 0 && s.end === text.length)) });

/** A paragraph block → items: headings set on their own line, a run-in heading, a recommendation. */
function paragraphItems(flat) {
  const { text, spans } = flat;
  if (!text) return [];
  // How far the bold opening runs (allowing a stray space or a full stop printed outside it).
  const bold = spans.find(s => s.type === 'strong' && s.start === 0);
  const boldEnd = bold ? bold.end : 0;

  if (bold && /^Recommendation\s*:/i.test(text) && boldEnd >= text.length - 2) {
    const body = slice(flat, text.indexOf(':') + 1);
    return [{ recommendation: true, ...plain(body.text, body.spans.filter(s => s.type !== 'strong')) }];
  }

  if (bold) {
    // Lines of the bold opening that end in a break are headings of their own.
    const items = [];
    let at = 0;
    for (;;) {
      const br = text.indexOf('\n', at);
      if (br === -1 || br > boldEnd) break;
      const line = slice(flat, at, br);
      if (line.text) items.push({ subheading: true, text: line.text, spans: line.spans.filter(s => s.type !== 'strong') });
      at = br + 1;
    }
    const rest = slice(flat, at);
    const restBold = Math.max(0, boldEnd - at - (text.slice(at).length - text.slice(at).trimStart().length));
    if (!rest.text) return items;
    if (restBold >= rest.text.length - 1) {
      // Bold to the end: a heading with nothing after it.
      items.push({ subheading: true, text: rest.text.replace(/\n/g, ' '), spans: [] });
      return items;
    }
    if (restBold > 0) {
      // A run-in heading: the bold words and the stop printed after them.
      let end = restBold;
      while (/[.:]/.test(rest.text[end] ?? '')) end++;
      const head = rest.text.slice(0, end).trim();
      const body = slice(rest, end);
      items.push({ run_in: head, text: body.text.replace(/\n/g, ' '), spans: body.spans.filter(s => !(s.type === 'strong' && s.end <= 0)) });
      return items;
    }
    items.push(lined(rest));
    return items;
  }
  return [lined(flat)];
}

/** A paragraph set as lines (Appendix C's lists of witnesses) keeps its breaks: `lines`, '\n' in the text. */
function lined({ text, spans }) {
  return text.includes('\n') ? { lines: true, text, spans } : { text, spans };
}

const oneLine = text => text.replace(/\s*\n\s*/g, ' ').trim();

/**
 * One part's blocks → { title, sections, recommendations }.
 * A section: { id, number, heading, level, items }. The first section (text before any heading)
 * has no heading.
 */
export function readPart(blocks, partId, { titleHeadings = 1 } = {}) {
  const noteId = number => `${partId}-n${number}`;
  const sections = [];
  let title = null;
  const section = (heading, number = null) => {
    const id = number ? `${partId}-s${number.replace(/\./g, '-')}` : `${partId}-s${sections.length}`;
    const s = { id, number, heading, level: 1, items: [] };
    sections.push(s);
    return s;
  };
  let current = null;

  for (const block of blocks) {
    if (block.tag === 'h2' || block.tag === 'h4') {
      const head = oneLine(flatten(block.runs, noteId).text);
      // The part's title; the summary prints two ("THE 9/11 COMMISSION REPORT", "Final Report … EXECUTIVE SUMMARY").
      if (block.tag === 'h2' && titleHeadings > 0 && !sections.length) {
        titleHeadings--;
        title = title ? `${title} ${head}` : head;
        continue;
      }
      const numbered = /^(\d+\.\d+)\s+(.*)$/.exec(head);
      current = numbered ? section(numbered[2], numbered[1]) : section(head);
      continue;
    }
    current ??= section(null);
    if (block.tag === 'table') {
      const [first, ...rest] = block.rows.filter(r => r.some(c => c));
      // Appendix B's table has a heading row in bold; A's has none.
      current.items.push({ type: 'table', head: [], rows: [first, ...rest].filter(Boolean), ...(block.box ? { box: block.box } : {}) });
      continue;
    }
    const flat = flatten(block.runs, noteId);
    const items = block.tag === 'li'
      ? [{ bullet: true, text: oneLine(flat.text), spans: flat.spans }]
      : paragraphItems(flat);
    for (const item of items) {
      if (block.quote > 0) {
        item.quoted = true;
        item.quote_level = block.quote;
      }
      if (block.box) item.box = block.box;
      current.items.push(item);
    }
  }
  return { title, sections: sections.filter(s => s.heading || s.items.length) };
}

/** The appendix file holds three appendices, each under its own <h2>; → the blocks of each, by heading. */
export function splitByHeading(blocks) {
  const parts = [];
  for (const block of blocks) {
    if (block.tag === 'h2') parts.push({ heading: oneLine(block.runs.map(r => r.text).join('')), blocks: [] });
    parts.at(-1)?.blocks.push(block);
  }
  return parts;
}

// ---------------------------------------------------------------------------
// Notes: one file, a heading per chapter ("1 \"We Have Some Planes\""), then "1. Text…". A note may
// run to several paragraphs, and a few contain numbered lists of their own (chapter 7's list of
// candidate hijackers, set in a blockquote), so a paragraph outside a quotation opens a new note only
// if its number follows the last one closely. A few notes are missing from the HTML (chapter 2 goes from
// 3 to 5); the gap is kept, and checkPart reports it.

/** Notes file blocks → Map(chapter number → [{ id, number, items }]). */
export function readNotes(blocks, partIdOf = n => `ch${n}`) {
  const chapters = new Map();
  let chapter = null;
  let notes = null;
  for (const block of blocks) {
    if (block.tag === 'h2') {
      const n = /^(\d+)\s/.exec(oneLine(block.runs.map(r => r.text).join('')))?.[1];
      if (!n) continue;
      chapter = n;
      notes = [];
      chapters.set(chapter, notes);
      continue;
    }
    if (!notes) continue; // the conventions printed before chapter 1
    const partId = partIdOf(chapter);
    const flat = flatten(block.runs, number => `${partId}-n${number}`);
    if (block.tag === 'table') continue;
    // A paragraph may also run several notes together ("…(Feb. 17, 2004). 100. Don…"): split it
    // where the next note's number follows the end of a sentence (not a page, "p. 110.").
    let rest = flat;
    for (;;) {
      const last = Number(notes.at(-1)?.number ?? 0);
      const open = /^(\d+)\.\s*/.exec(rest.text);
      const starts = open && !block.quote && Number(open[1]) > last && Number(open[1]) <= last + 6;
      const from = starts ? open[0].length : 0;
      const number = starts ? Number(open[1]) : last;
      let cut = -1;
      if (!block.quote) {
        const re = new RegExp(`(?<=[.)"”] )${number + 1}\\.(?!\\d)`, 'g');
        for (const m of rest.text.slice(from).matchAll(re)) {
          if (!/\bpp?\. *$/.test(rest.text.slice(0, from + m.index))) {
            cut = from + m.index;
            break;
          }
        }
      }
      const piece = slice(rest, from, cut === -1 ? undefined : cut);
      const entry = block.tag === 'li' ? { bullet: true, ...piece } : { ...piece };
      entry.text = oneLine(entry.text);
      if (block.quote) {
        entry.quoted = true;
        entry.quote_level = block.quote;
      }
      if (starts) notes.push({ id: `${partId}-n${open[1]}`, number: open[1], items: [entry] });
      else notes.at(-1)?.items.push(entry);
      if (cut === -1) break;
      rest = slice(rest, cut);
    }
  }
  return chapters;
}

/** A part's calls and its notes, compared: what looks wrong. */
export function checkPart(part) {
  const problems = [];
  const calls = part.sections.flatMap(s => s.items.flatMap(i => (i.spans ?? []).filter(sp => sp.type === 'footnote_ref').map(sp => Number(sp.number))));
  const notes = part.notes ?? [];
  if (calls.length || notes.length) {
    const list = (label, numbers) => numbers.length && problems.push(`${label}: ${numbers.slice(0, 10).join(', ')}${numbers.length > 10 ? '…' : ''}`);
    const have = new Set(notes.map(n => Number(n.number)));
    const called = new Set(calls);
    list('called, no note', [...called].filter(n => !have.has(n)));
    list('notes never called', [...have].filter(n => !called.has(n)));
    const order = calls.findIndex((n, i) => i > 0 && n < calls[i - 1]);
    if (order !== -1) problems.push(`calls out of order at ${calls[order - 1]} → ${calls[order]}`);
  }
  if (!part.sections.some(s => s.items.length)) problems.push('no text');
  return problems;
}

/**
 * Note calls the HTML prints as plain digits after the punctuation ("…for jihad training.52"),
 * not as <sup>: for each note that has no call, look between the calls before and after it for its
 * number in that position and turn it into a call. Changes the part's items in place; → the numbers recovered.
 */
export function recoverCalls(part) {
  const notes = part.notes ?? [];
  if (!notes.length) return [];
  const items = part.sections.flatMap(s => s.items).filter(i => typeof i.text === 'string');
  const callsIn = item => (item.spans ?? []).filter(s => s.type === 'footnote_ref').map(s => Number(s.number));
  const recovered = [];
  for (const note of notes) {
    const n = Number(note.number);
    if (items.some(i => callsIn(i).includes(n))) continue;
    const before = items.findLastIndex(i => callsIn(i).some(c => c < n));
    let after = items.findIndex(i => callsIn(i).some(c => c > n));
    if (after === -1) after = items.length - 1;
    for (const item of items.slice(Math.max(0, before), after + 1)) {
      const m = new RegExp(`(?<=[.,;:)"”’?!])${n}(?=\\s|$)`).exec(item.text);
      if (!m) continue;
      const at = m.index;
      const len = String(n).length;
      item.text = item.text.slice(0, at) + item.text.slice(at + len);
      item.spans = (item.spans ?? []).map(s => ({
        ...s,
        start: s.start > at ? s.start - len : s.start,
        end: s.end > at ? s.end - len : s.end,
      }));
      item.spans.push({ type: 'footnote_ref', start: at, end: at, number: String(n), target: note.id });
      item.spans.sort((a, b) => a.start - b.start || (a.type === 'footnote_ref' ? -1 : 1));
      recovered.push(n);
      break;
    }
  }
  return recovered;
}
