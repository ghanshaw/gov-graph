/**
 * U.S. Code title XML (USLM, as published by the Office of the Law Revision Counsel in its
 * release points: usc10.xml, usc05A.xml, …) → the hierarchy of the title and each section's
 * text in the shared shape (sections → items → spans, plus citations). See parse-bill-xml.js.
 *
 * Like bill XML, the structure is declared: every level is its own element (<subsection>,
 * <paragraph>, …) with a <num> and an optional <heading>, and every title, chapter and section
 * carries a USLM identifier ("/us/usc/t10/s1074c").
 *
 * What a Code section adds to the shared shape:
 *   - items carry `anchor` (the identifier below the section: "c", "b-1") and their heading is
 *     printed on its own line (`heading_break`), as the Code prints it, without ".—".
 *   - `source_credit`: the laws that enacted and amended the section, in the order printed.
 *   - `notes`: editorial and statutory notes (amendments, effective dates, codification, …),
 *     each with its `topic` and its own items. Statutory notes often set out whole provisions of
 *     other laws, so their items may be quoted or carry sub-headings (`subheading`).
 *   - `footnotes`, called from the text by zero-length `footnote_ref` spans.
 */

import { parseXml, isElement, child, plain, collapse } from './parse-bill-xml.js';

const LEVELS = ['subsection', 'paragraph', 'subparagraph', 'clause', 'subclause', 'item', 'subitem', 'subsubitem'];
// Units above the section. A title file's root is <title>, or <appendix> for the appendix titles.
const CONTAINERS = [
  'title', 'appendix', 'subtitle', 'chapter', 'subchapter', 'part', 'subpart', 'division', 'subdivision',
  'article', 'subarticle', 'compiledAct', 'courtRules', 'reorganizationPlans',
];
// Elements that hold block structure, as opposed to running text.
const BLOCKS = new Set([...LEVELS, ...CONTAINERS, 'section', 'level', 'p', 'table', 'toc', 'layout', 'content', 'chapeau', 'continuation']);

const elements = node => node.children.filter(isElement);
const hasBlocks = node => elements(node).some(c => BLOCKS.has(c.name) || hasBlocks(c));
// The units that carry text: sections, and in the appendix titles court rules and reorganization plans.
const UNITS = ['section', 'courtRule', 'reorganizationPlan'];
const hasSections = node => elements(node).some(c => UNITS.includes(c.name) || (c.name !== 'notes' && c.name !== 'note' && hasSections(c)));
// "(a)" → "a"; "1." stays (a numbered list), as in the bill and executive order parsers.
const marker = printed => (/^\((.+)\)$/.exec(printed)?.[1] ?? printed) || null;

/** "10", "5a" from "/us/usc/t10/…", "/us/usc/t5a" */
export const titleOfIdentifier = identifier => /^\/us\/usc\/t([^/]+)/.exec(identifier)?.[1] ?? null;

/** The section part of the URL: en dashes as hyphens ("300h–6" → "300h-6"). */
export const sectionSlug = number => String(number).replace(/[–—]/g, '-');

/** A USLM reference (`href`) → a citation target and an outside link where there is one. */
export function refTarget(href = '') {
  let m = /^\/us\/usc\/t([^/]+)\/s([^/]+)(?:\/(.+))?$/.exec(href);
  if (m) {
    const [, title, section, rest] = m;
    return {
      target: { type: 'usc', title, section: sectionSlug(section), ...(rest ? { subsection: rest } : {}) },
      href: `https://www.govinfo.gov/link/uscode/${title}/${sectionSlug(section)}`,
    };
  }
  m = /^\/us\/usc\/t([^/]+)(?:\/(.+))?$/.exec(href);
  if (m) return { target: { type: 'usc', title: m[1], ...(m[2] ? { unit: m[2] } : {}) }, href: null };
  m = /^\/us\/pl\/(\d+)\/(\d+)/.exec(href);
  if (m) return { target: { type: 'public_law', congress: m[1], number: m[2] }, href: `https://www.govinfo.gov/link/plaw/${m[1]}/public/${m[2]}` };
  m = /^\/us\/stat\/(\w+)\/(\d+)/.exec(href);
  if (m) return { target: { type: 'statute', volume: m[1], page: m[2] }, href: `https://www.govinfo.gov/link/statute/${m[1]}/${m[2]}` };
  return { target: { type: 'reference', cite: href }, href: null };
}

// ---------------------------------------------------------------------------
// Text: one walk turns a run of USLM content into items, splitting paragraphs at <p>, tables
// and block quotations, and recording spans (citations, emphasis, footnote calls) as it goes.

// Cell text, with the lines of a cell (<p>, <br/>) kept apart: "Revised Statutes and" / "Statutes at Large".
const cellText = node => plain({
  children: node.children.flatMap(c => {
    if (!isElement(c)) return [c];
    if (c.name === 'br') return [' '];
    return c.name === 'p' ? [' ', cellText(c), ' '] : [cellText(c)];
  }),
});

function tableItem(node, level) {
  const rows = [];
  const head = [];
  const visit = (n, inHead) => {
    for (const c of elements(n)) {
      if (c.name === 'tr') (inHead ? head : rows).push(elements(c).filter(e => e.name === 'td' || e.name === 'th').map(cellText));
      else if (c.name !== 'colgroup') visit(c, inHead || c.name === 'thead');
    }
  };
  visit(node, false);
  return { type: 'table', marker: null, level, head, rows, text: '', spans: [] };
}

// A printed list of contents (<toc><layout>): its header row and one row per entry.
function layoutItem(node, level) {
  const cells = row => elements(row).filter(c => c.name === 'column').map(plain);
  const rows = [];
  const head = [];
  const visit = n => {
    for (const c of elements(n)) {
      if (c.name === 'header') head.push(cells(c));
      else if (c.name === 'tocItem') rows.push(cells(c));
      else visit(c);
    }
  };
  visit(node);
  const keep = row => row.some(Boolean);
  return { type: 'table', marker: null, level, head: head.filter(keep), rows: rows.filter(keep), text: '', spans: [] };
}

/**
 * @param ctx { footnotes: [], citations: Map }
 * @returns items, in reading order
 */
function build(nodes, level, quote, ctx) {
  const out = [];
  let text = '';
  let spans = [];
  const quoteProps = () => (quote ? { quoted: true, quote_level: quote } : {});

  const flush = (extra = {}) => {
    const para = collapse(text, spans);
    text = '';
    spans = [];
    if (!para.text && !para.spans.some(s => s.type === 'footnote_ref')) return;
    out.push({ marker: null, level, ...para, ...quoteProps(), ...extra });
  };

  // A provision with its own number: "(b)", "(1)", …
  const provision = node => {
    flush();
    const printed = plain(child(node, 'num'));
    const heading = plain(child(node, 'heading')) || null;
    const rest = elements(node).filter(c => c.name !== 'num' && c.name !== 'heading');
    const lead = rest[0] && (rest[0].name === 'content' || rest[0].name === 'chapeau') ? rest.shift() : null;
    const own = lead ? build(lead.children, level + 1, quote, ctx) : [];
    const first = own[0] && !own[0].type ? own.shift() : { text: '', spans: [] };
    const anchor = node.attrs.identifier?.split('/').slice(5).join('-') || undefined;
    if (quote) {
      // Inside a quotation the number is part of the quoted text, as in amending bills.
      const lead = [printed, heading].filter(Boolean).join(' ');
      const shift = first.text ? lead.length + 1 : lead.length;
      out.push({
        marker: null, level: 0, quoted: true, quote_level: quote, ...(printed ? { quote_marker: printed } : {}),
        text: first.text ? `${lead} ${first.text}` : lead,
        spans: first.spans.map(s => ({ ...s, start: s.start + shift, end: s.end + shift })),
      });
    } else {
      out.push({
        marker: marker(printed.replace(/^\[|\]$/g, '')), level: level + 1,
        ...(heading ? { heading, heading_break: true } : {}),
        ...(anchor ? { anchor } : {}),
        text: first.text, spans: first.spans,
      });
    }
    out.push(...own.map(item => (item.type || item.marker || item.quoted ? item : { ...item, continuation: true })));
    out.push(...build(rest, level + 1, quote, ctx));
  };

  const walk = node => {
    if (!isElement(node)) {
      text += node.replace(/\s+/g, ' ');
      return;
    }
    const { name, attrs } = node;
    if (LEVELS.includes(name)) return provision(node);
    if (name === 'section' || name === 'level' || CONTAINERS.includes(name)) {
      // A section or heading set out inside a note or quotation: its number and heading as a line.
      flush();
      const label = [plain(child(node, 'num')), plain(child(node, 'heading'))].filter(Boolean).join(' ');
      if (label) out.push({ marker: null, level: quote ? 0 : level, text: label, spans: [], subheading: true, ...quoteProps() });
      out.push(...build(elements(node).filter(c => c.name !== 'num' && c.name !== 'heading'), level, quote, ctx));
      return;
    }
    if (name === 'p') {
      flush();
      node.children.forEach(walk);
      flush();
      return;
    }
    if (name === 'continuation') {
      flush();
      node.children.forEach(walk);
      flush({ continuation: true });
      return;
    }
    if (name === 'table') {
      flush();
      out.push({ ...tableItem(node, level), ...quoteProps() });
      return;
    }
    if (name === 'toc' || name === 'layout') {
      flush();
      out.push({ ...layoutItem(node, level), ...quoteProps() });
      return;
    }
    if (name === 'quotedContent' && hasBlocks(node)) {
      // Provisions set out in full: the sentence that introduces them, then the quotation.
      flush();
      out.push(...build(node.children, level, (quote || 0) + 1, ctx));
      return;
    }
    if (name === 'note' && attrs.type === 'footnote') {
      const own = build(node.children.filter(c => !isElement(c) || c.name !== 'num'), 0, 0, ctx).filter(i => !i.type);
      const joined = collapse(own.map(i => i.text).join(' '), []);
      ctx.footnotes.push({ id: `fn-${attrs.id ?? ctx.footnotes.length + 1}`, number: plain(child(node, 'num')), text: joined.text });
      return;
    }
    if (name === 'ref' && attrs.class === 'footnoteRef') {
      spans.push({ start: text.length, end: text.length, type: 'footnote_ref', number: plain(node), target: `fn-${attrs.idref}` });
      return;
    }
    if (name === 'sourceCredit' || name === 'notes') return; // kept apart (see parseSection)
    if (name === 'br') {
      text += ' ';
      return;
    }

    const start = text.length;
    if ((name === 'num' || name === 'heading') && text && !text.endsWith(' ')) text += ' ';
    node.children.forEach(walk);
    if (name === 'num' || name === 'heading') text += ' ';
    const end = text.length;
    if (end === start) return;
    const span = (type, extra = {}) => spans.push({ start, end, type, ...extra, text: text.slice(start, end) });
    if (name === 'ref' && attrs.href) {
      const cite = refTarget(attrs.href);
      span('citation', cite);
      const key = cite.href ?? attrs.href;
      const entry = ctx.citations.get(key) ?? { ...cite.target, href: cite.href, labels: [] };
      const label = text.slice(start, end).trim();
      if (!entry.labels.includes(label)) entry.labels.push(label);
      ctx.citations.set(key, entry);
    } else if (name === 'i') span('emphasis');
  };
  nodes.forEach(walk);
  flush();
  return out;
}

// ---------------------------------------------------------------------------
// Sections

function sourceCredit(node, ctx) {
  if (!node) return null;
  const [para] = build(node.children, 0, 0, ctx);
  // Each law is a Public Law reference followed by its date and its Statutes at Large page.
  const laws = [];
  let current = null;
  for (const ref of node.children.filter(c => isElement(c) && (c.name === 'ref' || c.name === 'date'))) {
    if (ref.name === 'date') {
      if (current && !current.date) current.date = ref.attrs.date ?? null;
      continue;
    }
    const href = ref.attrs.href ?? '';
    let m = /^\/us\/pl\/(\d+)\/(\d+)/.exec(href);
    if (m) {
      laws.push(current = { public_law: `${m[1]}-${m[2]}`, cite: plain(ref), date: null, statute: null });
      continue;
    }
    m = /^\/us\/stat\/(\w+)\/(\d+)/.exec(href);
    if (m && current && !current.statute) current.statute = `${m[1]} Stat. ${m[2]}`;
    else if (m) laws.push(current = { public_law: null, cite: plain(ref), date: null, statute: `${m[1]} Stat. ${m[2]}` });
    else if (/^\/us\/act\//.test(href)) laws.push(current = { public_law: null, cite: plain(ref), date: null, statute: null });
  }
  return { text: para?.text ?? plain(node), spans: para?.spans ?? [], laws };
}

function notesOf(node, ctx) {
  if (!node) return [];
  return elements(node).filter(n => n.name === 'note').map(note => ({
    topic: note.attrs.topic ?? null,
    ...(note.attrs.role === 'crossHeading' ? { cross_heading: true } : {}),
    heading: plain(child(note, 'heading')) || null,
    items: build(elements(note).filter(c => c.name !== 'heading'), 0, 0, ctx),
  }));
}

function parseSection(node) {
  const ctx = { footnotes: [], citations: new Map() };
  const body = elements(node).filter(c => !['num', 'heading', 'sourceCredit', 'notes'].includes(c.name));
  const items = build(body, 0, 0, ctx);
  const textCitations = new Map(ctx.citations);
  const source_credit = sourceCredit(child(node, 'sourceCredit'), { ...ctx, citations: new Map() });
  const notes = notesOf(child(node, 'notes'), { ...ctx, citations: new Map() });
  return {
    items,
    source_credit,
    notes,
    ...(ctx.footnotes.length ? { footnotes: ctx.footnotes } : {}),
    // Citations in the section's own text (not its notes), for the graph.
    citations: [...textCitations.values()],
  };
}

// ---------------------------------------------------------------------------
// A title file

/**
 * @param {string} xml one title file from a release point (usc10.xml)
 * @returns {{ title, nodes, warnings }}
 *   title: { number, identifier, name, label, positive_law, release, appendix }
 *   nodes: every container and section, in reading order; sections carry `structure`.
 */
export function parseUscodeTitle(xml) {
  const doc = parseXml(xml).children.find(isElement);
  const meta = child(doc, 'meta');
  const main = child(doc, 'main');
  // The appendix titles have no <main>: their <appendix> sits beside <meta>.
  const rootNode = elements(main ?? doc).find(c => c.name === 'title' || c.name === 'appendix');
  if (!rootNode) throw new Error('no <title> or <appendix>');

  const number = plain(child(meta, 'docNumber')) || titleOfIdentifier(doc.attrs.identifier);
  const property = role => elements(meta).find(c => c.name === 'property' && c.attrs.role === role);
  const publication = plain(child(meta, 'docPublicationName')); // "Online@119-36"
  const warnings = [];
  const nodes = [];
  const used = new Map(); // identifier → times seen; the Code has a few duplicated section numbers

  const slugs = new Set();
  const uniqueSlug = base => {
    let slug = base;
    for (let n = 2; slugs.has(slug); n++) slug = `${base}_${n}`;
    slugs.add(slug);
    return slug;
  };
  const unique = identifier => {
    const n = (used.get(identifier) ?? 0) + 1;
    used.set(identifier, n);
    return n === 1 ? identifier : `${identifier}~${n}`;
  };

  const visit = (node, parent, depth) => {
    for (const c of elements(node)) {
      if (UNITS.includes(c.name)) {
        const printed = plain(child(c, 'num'));
        const value = child(c, 'num')?.attrs.value ?? printed.replace(/^\[?§+\s*|\.\]?$/g, '');
        const base = c.attrs.identifier ?? `${parent.identifier}/s${value}`;
        if (!c.attrs.identifier) warnings.push(`section without identifier: ${base}`);
        const identifier = unique(base);
        // A section's URL is its number; a rule or plan's, or a section the publisher gave no
        // identifier (one Act among several in an appendix), is its path below the title
        // ("courtRules-Civil-rule12"). A number printed twice gets "_2".
        const slug = uniqueSlug(c.name === 'section' && c.attrs.identifier
          ? sectionSlug(base.split('/').at(-1).replace(/^s/, ''))
          : sectionSlug(base.split('/').slice(4).join('-')));
        nodes.push({
          identifier, kind: c.name, number: value || null, label: printed || null,
          slug,
          heading: plain(child(c, 'heading')) || null,
          parent: parent.identifier, depth, status: c.attrs.status ?? null,
          structure: parseSection(c),
        });
      } else if (CONTAINERS.includes(c.name) || (c.name === 'level' && hasSections(c))) {
        // <level>: an unnumbered heading over a group of sections
        const value = child(c, 'num')?.attrs.value ?? plain(child(c, 'num'));
        const base = c.attrs.identifier ?? `${parent.identifier}/${c.name}${value}`;
        const entry = {
          identifier: unique(base), kind: c.name, number: value || null, label: plain(child(c, 'num')) || null,
          slug: null, heading: plain(child(c, 'heading')) || null,
          parent: parent.identifier, depth, status: c.attrs.status ?? null,
        };
        nodes.push(entry);
        visit(c, entry, depth + 1);
      } else if (!['num', 'heading', 'notes', 'note', 'toc', 'sourceCredit'].includes(c.name) && hasBlocks(c)) {
        warnings.push(`unhandled <${c.name}> in ${parent.identifier}`);
      }
    }
  };

  const title = {
    // Title 50 Appendix, eliminated, carries no identifier at all.
    identifier: rootNode.attrs.identifier ?? doc.attrs.identifier ?? `/us/usc/t${number.toLowerCase()}`,
    number,
    label: plain(child(rootNode, 'num')) || null,
    name: plain(child(rootNode, 'heading')) || null,
    positive_law: property('is-positive-law') ? plain(property('is-positive-law')) === 'yes' : null,
    appendix: rootNode.name === 'appendix',
    release: publication.split('@')[1] ?? null,
  };
  visit(rootNode, title, 0);
  return { title, nodes, warnings };
}
