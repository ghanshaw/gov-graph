/**
 * Bill text XML (the House/Senate "bill.dtd" format published at govinfo and congress.gov)
 * → structured form, in the same shape the executive order parser produces:
 * sections → items → spans, plus citations. See parse-executive-order.js and
 * research/legal-document-structure.md.
 *
 * Unlike the Federal Register HTML, the structure here is declared, not inferred: every
 * level is its own element (<subsection>, <paragraph>, …) with its <enum> and <header>.
 *
 * What a bill adds to the shared shape:
 *   - `outline`: the divisions/titles/subtitles/chapters/parts above the sections, as a tree
 *     whose leaves point at sections by id.
 *   - items may carry `heading` ("In general"), `changed` ("added" | "deleted", from a
 *     reported version's amendment markup) and `type: "table"`.
 *   - spans may be `inserted` / `deleted` (amendment markup inside a sentence).
 */

// ---------------------------------------------------------------------------
// A small XML reader. The bill and bill status files are plain well-formed XML without
// namespaces in the body, so a tokenizer is enough; it keeps mixed content in document order.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

const decode = text => text
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
  .replace(/&([a-z]+);/g, (m, name) => ENTITIES[name] ?? m);

export function parseXml(xml) {
  const root = { name: '#root', attrs: {}, children: [] };
  const stack = [root];
  const token = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<![^>]*>|<\/([\w:-]+)\s*>|<([\w:-]+)((?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  for (let m; (m = token.exec(xml)); ) {
    const parent = stack.at(-1);
    if (m[1] != null) {
      parent.children.push(m[1]); // CDATA: literal text (bill status summaries carry HTML this way)
      continue;
    }
    m = [m[0], ...m.slice(2)];
    if (m[1]) {
      stack.pop();
    } else if (m[2]) {
      const attrs = {};
      for (const a of m[3].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = decode(a[2] ?? a[3]);
      const node = { name: m[2], attrs, children: [] };
      parent.children.push(node);
      if (!m[4]) stack.push(node);
    } else if (m[5]) {
      parent.children.push(decode(m[5]));
    }
  }
  return root;
}

export const isElement = node => typeof node === 'object';
export const child = (node, name) => node.children.find(c => isElement(c) && c.name === name);
export const descend = (node, name) => {
  for (const c of node.children) {
    if (!isElement(c)) continue;
    if (c.name === name) return c;
    const found = descend(c, name);
    if (found) return found;
  }
  return null;
};
export const plain = node => (node ? node.children.map(c => (isElement(c) ? plain(c) : c)).join('') : '').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------
// Inline text and spans

function citation(node) {
  const cite = node.attrs['parsable-cite'] ?? '';
  const parts = cite.split('/');
  if (parts[0] === 'usc' && parts[2]) {
    return { target: { type: 'usc', title: parts[1], section: parts[2] }, href: `https://www.govinfo.gov/link/uscode/${parts[1]}/${parts[2]}` };
  }
  if (parts[0] === 'pl' && parts[2]) {
    return { target: { type: 'public_law', congress: parts[1], number: parts[2] }, href: `https://www.govinfo.gov/link/plaw/${parts[1]}/public/${parts[2]}` };
  }
  if (parts[0] === 'usc-chapter' || parts[0] === 'usc-appendix') {
    return { target: { type: 'usc', title: parts[1], chapter: parts.slice(2).join('/') || undefined }, href: null };
  }
  return { target: { type: node.attrs['legal-doc'] ?? 'reference', cite }, href: null };
}

/** Mixed content → plain text plus spans addressed by character offset. */
function inline(nodes, prefix = '') {
  let text = prefix;
  const spans = [];

  const walk = node => {
    if (!isElement(node)) {
      text += node.replace(/\s+/g, ' ');
      return;
    }
    // Defined terms and quoted words are printed inside quotation marks.
    const quoted = node.name === 'term' || node.name === 'quote';
    if (quoted) text += '“';
    const innerStart = text.length;
    node.children.forEach(walk);
    const innerEnd = text.length;
    if (quoted) text += '”';
    if (innerEnd === innerStart) return;

    const span = (type, extra = {}) => spans.push({ start: innerStart, end: innerEnd, type, ...extra, text: text.slice(innerStart, innerEnd) });
    if (node.name === 'external-xref') span('citation', citation(node));
    else if (node.name === 'term') span('defined_term');
    else if (node.name === 'italic') span('emphasis');
    else if (node.name === 'deleted-phrase') span('deleted');
    else if (node.name === 'added-phrase') span('inserted');
  };
  nodes.forEach(walk);
  return collapse(text, spans);
}

/** Collapse the whitespace the XML's line breaks leave behind, keeping span offsets true. */
export function collapse(text, spans) {
  let out = '';
  const map = new Array(text.length + 1);
  for (let i = 0; i < text.length; i++) {
    map[i] = out.length;
    const ch = text[i];
    if (ch === ' ' && (out.endsWith(' ') || out.length === 0)) continue;
    out += ch;
  }
  map[text.length] = out.length;
  const trimmed = out.trimEnd();
  const fixed = spans
    .map(s => ({ ...s, start: map[s.start], end: Math.min(map[s.end], trimmed.length) }))
    .filter(s => s.end > s.start || s.type === 'footnote_ref') // a footnote call has no length
    .map(s => ({ ...s, text: trimmed.slice(s.start, s.end) }))
    .sort((a, b) => a.start - b.start)
    .map(({ start, end, type, text: spanText, ...rest }) => ({ start, end, type, ...rest, text: spanText }));
  return { text: trimmed, spans: fixed };
}

// ---------------------------------------------------------------------------
// Structure

const CONTAINERS = ['division', 'title', 'subtitle', 'chapter', 'subchapter', 'part', 'subpart'];
const LEVELS = ['subsection', 'paragraph', 'subparagraph', 'clause', 'subclause', 'item', 'subitem'];

const enumOf = node => plain(child(node, 'enum'));
const headingOf = node => plain(child(node, 'header')) || null;
// "(a)" → "a"; "1." stays (a numbered list), matching the executive order markers.
const marker = printed => (/^\((.+)\)$/.exec(printed)?.[1] ?? printed) || null;

function tableItem(node, level) {
  const rows = part => {
    const group = descend(node, part);
    return group
      ? group.children.filter(r => isElement(r) && r.name === 'row')
        .map(r => r.children.filter(e => isElement(e) && e.name === 'entry').map(plain))
      : [];
  };
  return { type: 'table', marker: null, level, head: rows('thead'), rows: rows('tbody'), text: '', spans: [] };
}

// A printed table of contents (<toc>): one entry per title, subtitle, … or section, indented
// by how many containers it sits inside. `idref` is the XML id of what the entry points at;
// parseBillXml turns it into `target`, the anchor of that heading in our own output.
function tocItem(node, level) {
  const open = []; // container kinds currently open, outermost first
  const entries = [];
  for (const entry of node.children) {
    if (!isElement(entry) || entry.name !== 'toc-entry') continue;
    const kind = entry.attrs.level ?? 'section';
    const rank = CONTAINERS.indexOf(kind);
    if (rank !== -1) {
      while (open.length && open.at(-1) >= rank) open.pop();
      open.push(rank);
    }
    entries.push({
      text: plain(entry),
      depth: rank === -1 ? open.length : open.length - 1,
      kind,
      idref: entry.attrs.idref ?? null,
    });
  }
  return { type: 'toc', marker: null, level, entries, text: '', spans: [] };
}

/** Items of one section, flattened in reading order. */
function sectionItems(section, inherited) {
  const items = [];

  // Text set out in quotation marks: replacement text for the law being amended. Each
  // provision becomes an unmarked, `quoted` item whose text carries its marker as printed,
  // the form the executive order parser gives quoted provisions.
  const quotedRun = (block, after, changed) => {
    const first = items.length;
    const walk = (node, depth) => {
      for (const c of node.children) {
        if (!isElement(c)) continue;
        if (c.name === 'section' || CONTAINERS.includes(c.name)) {
          const label = c.name === 'section' ? `SEC. ${enumOf(c)}` : `${c.name.toUpperCase()} ${enumOf(c)}`;
          items.push({ marker: null, level: 0, quoted: true, quote_level: 0, ...inline([], [label, headingOf(c)].filter(Boolean).join(' ')), ...(changed ? { changed } : {}) });
          walk(c, c.name === 'section' ? 0 : depth);
        } else if (LEVELS.includes(c.name)) {
          const printed = enumOf(c);
          const heading = headingOf(c);
          const own = child(c, 'text');
          const lead = `${printed} ${heading ? `${heading}.—` : ''}`;
          items.push({
            marker: null, level: 0, quoted: true, quote_level: depth + 1,
            ...(printed ? { quote_marker: printed } : {}),
            ...inline(own ? own.children : [], lead),
            ...(changed ? { changed } : {}),
          });
          walk(c, depth + 1);
        } else if (c.name === 'text' && node === block) {
          items.push({ marker: null, level: 0, quoted: true, quote_level: depth, ...inline(c.children), ...(changed ? { changed } : {}) });
        } else if (c.name === 'continuation-text' || c.name === 'quoted-block-continuation-text') {
          items.push({ marker: null, level: 0, quoted: true, quote_level: depth, ...inline(c.children), ...(changed ? { changed } : {}) });
        } else if (c.name === 'table') {
          items.push({ ...tableItem(c, 0), quoted: true, quote_level: depth });
        } else if (c.name === 'toc') {
          items.push({ ...tocItem(c, 0), quoted: true, quote_level: depth });
        } else if (c.name === 'quoted-block') {
          walk(c, depth + 1);
        }
      }
    };
    walk(block, 0);

    // Opening mark on the first provision; closing mark and what follows it (". " or "; and") on the last.
    const run = items.slice(first).filter(i => !i.type);
    if (run.length === 0) return;
    const open = run[0];
    open.text = `“${open.text}`;
    open.spans = open.spans.map(s => ({ ...s, start: s.start + 1, end: s.end + 1 }));
    run.at(-1).text += `”${plain(after)}`;
  };

  const walk = (node, level, changed) => {
    const kids = node.children.filter(isElement);
    kids.forEach((c, i) => {
      const mark = c.attrs.changed ?? changed;
      if (LEVELS.includes(c.name)) {
        const own = child(c, 'text');
        const heading = headingOf(c);
        items.push({
          marker: marker(enumOf(c)),
          level: level + 1,
          ...(heading ? { heading } : {}),
          ...inline(own ? own.children : []),
          ...(mark ? { changed: mark } : {}),
        });
        walk(c, level + 1, mark);
      } else if (c.name === 'text' && node.name === 'section') {
        items.push({ marker: null, level: 0, ...inline(c.children), ...(mark ? { changed: mark } : {}) });
      } else if (c.name === 'continuation-text') {
        // Text that resumes after sub-items, at the depth of the provision it continues.
        items.push({ marker: null, level, continuation: true, ...inline(c.children), ...(mark ? { changed: mark } : {}) });
      } else if (c.name === 'quoted-block') {
        // What follows the closing quotation mark (".", "; and") is the block's last child.
        const after = child(c, 'after-quoted-block') ?? (kids[i + 1]?.name === 'after-quoted-block' ? kids[i + 1] : null);
        quotedRun(c, after, mark);
      } else if (c.name === 'table') {
        items.push({ ...tableItem(c, level), ...(mark ? { changed: mark } : {}) });
      } else if (c.name === 'toc') {
        items.push({ ...tocItem(c, level), ...(mark ? { changed: mark } : {}) });
      }
    });
  };
  walk(section, 0, section.attrs.changed ?? inherited);
  return items;
}

/**
 * @param {string} xml   bill text XML for one version (e.g. BILLS-119hr1enr.xml)
 * @param {object} meta  { package_id, congress, bill_type, number, version: { code, label, date } }
 */
export function parseBillXml(xml, meta = {}) {
  const root = parseXml(xml).children.find(isElement);
  // A bill or resolution has a <legis-body>. An engrossed amendment ("strike all after the
  // first word, and insert the following") carries the replacement text in an <amendment-block>.
  // A reported bill with a committee substitute has two bodies: the original text marked
  // deleted and the substitute marked added.
  const amendmentBlock = descend(root, 'amendment-block');
  // Resolutions have a <resolution-body>, and usually a <preamble> of "Whereas" clauses before it.
  let bodies = root.children.filter(c => isElement(c) && (c.name === 'legis-body' || c.name === 'resolution-body'));
  const instruction = bodies.length === 0 && amendmentBlock ? plain(descend(root, 'amendment-instruction')) : null;
  if (bodies.length === 0 && amendmentBlock) bodies = [amendmentBlock];
  if (bodies.length === 0) throw new Error(`no bill text in ${meta.package_id ?? 'bill XML'}`);

  const usedIds = new Set();
  const uniqueId = base => {
    let id = base;
    for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
    usedIds.add(id);
    return id;
  };
  const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const sections = [];
  const citations = [];
  const anchors = {}; // XML id → anchor in our output, for table-of-contents links

  // An engrossed amendment marks its whole text "added"; that says nothing, so it is dropped.
  const changeOf = (node, inherited) => (instruction ? undefined : node.attrs.changed ?? inherited);

  const outlineOf = (node, path, inherited) => {
    const out = [];
    for (const c of node.children) {
      if (!isElement(c)) continue;
      if (CONTAINERS.includes(c.name)) {
        const number = enumOf(c);
        const id = uniqueId(`${c.name}-${slug(number) || 'x'}`);
        const changed = changeOf(c, inherited);
        if (c.attrs.id) anchors[c.attrs.id] = id;
        out.push({
          type: c.name, number, heading: headingOf(c), id,
          ...(changed ? { changed } : {}),
          children: outlineOf(c, [...path, id], changed),
        });
      } else if (c.name === 'section') {
        const number = enumOf(c).replace(/\.$/, '');
        const id = uniqueId(`sec-${slug(number) || 'x'}`);
        const changed = changeOf(c, inherited);
        if (c.attrs.id) anchors[c.attrs.id] = id;
        const items = sectionItems(c, changed);
        if (instruction) items.forEach(item => delete item.changed);
        const section = {
          number, title: headingOf(c), id, path,
          ...(changed ? { changed } : {}),
          items,
        };
        sections.push(section);
        out.push({ type: 'section', number, heading: section.title, id });

        for (const item of items) {
          for (const span of item.spans.filter(s => s.type === 'citation')) {
            const key = span.href ?? JSON.stringify(span.target);
            let entry = citations.find(x => x.key === key);
            if (!entry) citations.push(entry = { key, ...span.target, href: span.href, labels: [], cited_in: [] });
            if (!entry.labels.includes(span.text)) entry.labels.push(span.text);
            if (!entry.cited_in.includes(number)) entry.cited_in.push(number);
          }
        }
      }
    }
    return out;
  };
  const outline = bodies.flatMap(body => outlineOf(body, [], changeOf(body)));

  // A resolution's "Whereas …" clauses, in the form of the executive order preamble.
  const preamble = root.children
    .filter(c => isElement(c) && c.name === 'preamble')
    .flatMap(p => p.children.filter(c => isElement(c) && c.name === 'whereas'))
    .map(w => inline((child(w, 'text') ?? w).children));

  // Contents entries can point forward, so their links are resolved once everything has an anchor.
  for (const section of sections) {
    for (const item of section.items.filter(i => i.type === 'toc')) {
      item.entries = item.entries.map(({ idref, ...entry }) => ({ ...entry, target: anchors[idref] ?? null }));
    }
  }
  // The short title is in the text as it now stands, not in a struck-out original.
  const current = bodies.findLast(body => body.attrs.changed !== 'deleted') ?? bodies[0];
  const firstSection = current.children.find(c => isElement(c) && c.name === 'section');

  return {
    doc_type: 'bill',
    congress: meta.congress ?? null,
    bill_type: meta.bill_type ?? null,
    number: meta.number ?? null,
    version: {
      ...meta.version,
      stage: root.attrs['bill-stage'] ?? root.attrs['resolution-stage'] ?? root.attrs['amend-type'] ?? null,
      package_id: meta.package_id ?? null,
      ...(instruction ? { amendment_instruction: instruction } : {}),
    },
    title: plain(descend(root, 'official-title')) || null,
    // The date printed on this version (Dublin Core metadata).
    date: /^\d{4}-\d{2}-\d{2}$/.test(plain(descend(root, 'dc:date'))) ? plain(descend(root, 'dc:date')) : null,
    // "This Act may be cited as the …" sits in the first section; later <short-title>s name other Acts.
    short_title: plain(descend(firstSection ?? { children: [] }, 'short-title')) || null,
    ...(preamble.length ? { preamble } : {}),
    outline,
    sections,
    citations: citations.map(({ key, ...rest }) => rest),
  };
}
