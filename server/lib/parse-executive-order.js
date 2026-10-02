/**
 * Federal Register full-text HTML for an executive order → structured form
 * (preamble, sections → items → spans, signature, end matter, citations).
 *
 * The shape follows server/references/eo-13636.json. The Federal Register markup is flat
 * (paragraphs with inline <strong>/<em>/<a>), so this works on the text directly rather
 * than through a DOM. Covers 2009 onward; see research/legal-document-structure.md.
 */

const FR_ORIGIN = 'https://www.federalregister.gov';

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  mdash: '—', ndash: '–', sect: '§', para: '¶', hellip: '…',
  thinsp: ' ', ensp: ' ', emsp: ' ', // "§&thinsp;2.1" in quoted regulations
  eacute: 'é', aacute: 'á', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
  agrave: 'à', egrave: 'è', acirc: 'â', ecirc: 'ê', ocirc: 'ô', ccedil: 'ç', ouml: 'ö',
};

function decode(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name] ?? ENTITIES[name.toLowerCase()] ?? m);
}

const stripTags = html => decode(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

/** Correction (C1-), republication (R1-) and similar notices share an order's number but are not the order. */
export function isNotice(documentNumber) {
  return /^[CRZ]\d-/.test(documentNumber ?? '');
}

// ---------------------------------------------------------------------------
// Inline text and spans

function citationTarget(cls, href) {
  let m;
  if (cls.includes('eo') && (m = /executive-order\/(\d+)/.exec(href))) return { type: 'executive_order', number: m[1] };
  if (cls.includes('usc') && (m = /uscode\/([^/]+)\/([^/?#]+)/.exec(href))) return { type: 'usc', title: m[1], section: m[2] };
  if (cls.includes('publ') && (m = /plaw\/(\d+)\/public\/(\d+)/.exec(href))) return { type: 'public_law', congress: m[1], number: m[2] };
  if (cls.includes('cfr') && (m = /title-(\d+)(?:\/.*?(part|section)-([\w.-]+))?/.exec(href))) {
    return { type: 'cfr', title: m[1], ...(m[2] ? { [m[2]]: m[3] } : {}) };
  }
  if (cls.includes('fr-reference') && (m = /citation\/(\d+)-FR-(\d+)/.exec(href))) {
    return { type: 'federal_register', volume: m[1], page: m[2] };
  }
  return { type: 'link' };
}

const DEADLINE = /\b[Ww]ithin (\d+) (hour|day|week|month|year)s? (?:of|after|from) (?:the date of this order|[^,.;:()]{1,70}?(?=[,.;:]))/g;
const DEFINED_TERM = /^(?:(?:[Tt]he|[Aa]n?) terms? )?“([^”]{1,80})”(?=,? (?:means|shall mean|has the meaning|shall have the meaning|have the meaning|includes?|refers? to|and “))/;

/** Inline HTML (whitespace already collapsed) → plain text plus spans addressed by character offset. */
function inline(src, { definitions = false } = {}) {
  // The Federal Register pretty-prints inline tags onto their own lines, which leaves a
  // stray space between a closing tag and the punctuation that follows it.
  src = src.replace(/(<\/(?:a|em|strong)>) (?=[,.;:)”’])/g, '$1').trim();

  let text = '';
  const spans = [];
  const open = [];
  const tag = /<(\/?)([a-z0-9]+)\b([^>]*)>/gi;
  let last = 0;
  let m;
  while ((m = tag.exec(src))) {
    text += decode(src.slice(last, m.index));
    last = tag.lastIndex;
    const name = m[2].toLowerCase();
    if (name !== 'em' && name !== 'a') continue; // other inline tags: keep their text only
    if (!m[1]) {
      const span = { start: text.length, end: null };
      if (name === 'em') {
        span.type = 'emphasis';
      } else {
        const href = /href="([^"]*)"/.exec(m[3])?.[1] ?? '';
        const cls = /class="([^"]*)"/.exec(m[3])?.[1] ?? '';
        span.type = 'citation';
        span.target = citationTarget(cls, href);
        span.href = href.startsWith('/') ? FR_ORIGIN + href : href;
      }
      open.push({ name, span });
    } else {
      const idx = open.map(o => o.name).lastIndexOf(name);
      if (idx === -1) continue;
      const [{ span }] = open.splice(idx, 1);
      span.end = text.length;
      span.text = text.slice(span.start, span.end);
      if (span.text.trim()) spans.push(span);
    }
  }
  text += decode(src.slice(last));

  const trimmed = text.trimEnd();
  for (const span of spans) span.end = Math.min(span.end, trimmed.length);
  text = trimmed;

  const overlaps = (start, end) => spans.some(s => start < s.end && end > s.start);
  for (const d of text.matchAll(DEADLINE)) {
    const end = d.index + d[0].length;
    if (!overlaps(d.index, end)) {
      spans.push({ start: d.index, end, type: 'deadline', amount: Number(d[1]), unit: d[2], text: d[0] });
    }
  }
  if (definitions) {
    const term = DEFINED_TERM.exec(text);
    if (term) {
      const start = term[0].lastIndexOf('“') + 1;
      if (!overlaps(start, start + term[1].length)) {
        spans.push({ start, end: start + term[1].length, type: 'defined_term', text: term[1] });
      }
    }
  }

  // Key order follows the reference JSON: start, end, type, then type-specific fields.
  const ordered = spans
    .sort((a, b) => a.start - b.start)
    .map(({ start, end, type, text: spanText, ...rest }) => ({ start, end, type, ...rest, text: spanText }));
  return { text, spans: ordered };
}

// ---------------------------------------------------------------------------
// Item markers: (a) → (i) → (A) → (1) is the usual order, but orders vary, so the level
// of an item is its depth in the stack of marker kinds seen so far in the section.

const ROMAN = { i: 1, v: 5, x: 10, l: 50, c: 100 };

function romanValue(marker) {
  const s = marker.toLowerCase();
  if (!/^(?=[ivxlc])(c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/.test(s)) return null;
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const value = ROMAN[s[i]];
    total += value < (ROMAN[s[i + 1]] ?? 0) ? -value : value;
  }
  return total;
}

// a…z, then aa…zz, aaa…zzz
const alphaIndex = marker => (marker.length - 1) * 26 + (marker.toLowerCase().charCodeAt(0) - 97);

const MARKER = /^\((([a-z])\2{0,3}|[ivxlc]{1,7}|[A-Z]|[IVX]{1,5}|\d{1,3})\)\s*/;
// Numbered lists ("1. The contractor will …"). The marker keeps its period ("1.") so it
// can be told apart from "(1)".
const NUMBERED = /^(\d{1,2}\.)\s+(?=\S)/;
const markerAt = src => MARKER.exec(src)?.[1] ?? NUMBERED.exec(src)?.[1] ?? null;

function candidateKinds(marker) {
  if (/^\d+\.$/.test(marker)) return ['ordinal'];
  if (/^\d+$/.test(marker)) return ['digit'];
  const kinds = [];
  if (/^[a-z]+$/.test(marker)) {
    if (romanValue(marker)) kinds.push('roman');
    if (/^([a-z])\1*$/.test(marker)) kinds.push('alpha');
  } else {
    if (romanValue(marker)) kinds.push('ROMAN');
    if (marker.length === 1) kinds.push('ALPHA');
  }
  return kinds;
}

function isSuccessor(kind, previous, marker) {
  if (kind === 'digit' || kind === 'ordinal') return parseInt(marker, 10) === parseInt(previous, 10) + 1;
  if (kind === 'roman' || kind === 'ROMAN') return romanValue(marker) === romanValue(previous) + 1;
  return alphaIndex(marker) === alphaIndex(previous) + 1;
}

const isFirst = (kind, marker) =>
  kind === 'digit' || kind === 'ordinal' ? parseInt(marker, 10) === 1 : kind.toLowerCase() === 'roman' ? romanValue(marker) === 1 : alphaIndex(marker) === 0;

/** Decide which kind of marker this is, update the stack, and return the item's level. */
function placeMarker(stack, marker, nextMarker) {
  const kinds = candidateKinds(marker);
  const inStack = kind => stack.findLast(entry => entry.kind === kind);

  let kind = kinds[0];
  if (kinds.length > 1) {
    const continuing = kinds.filter(k => inStack(k) && isSuccessor(k, inStack(k).last, marker));
    const starting = kinds.filter(k => !inStack(k) && isFirst(k, marker));
    if (continuing.length && starting.length) {
      // "(i)" after "(h)": the letter i, or the first roman sub-item of (h)? Look at what follows.
      const next = starting[0];
      kind = nextMarker && isSuccessor(next, marker, nextMarker) && candidateKinds(nextMarker).includes(next)
        ? next
        : continuing[0];
    } else if (continuing.length) {
      kind = continuing.at(-1);
    } else if (starting.length) {
      kind = starting[0];
    } else {
      // Out of sequence (amending orders quote single provisions): prefer a kind already in use.
      kind = kinds.find(k => inStack(k)) ?? kinds.find(k => k.toLowerCase() === 'alpha') ?? kinds[0];
    }
  }

  const index = stack.findLastIndex(entry => entry.kind === kind);
  if (index === -1) {
    stack.push({ kind, last: marker });
  } else {
    stack.length = index + 1;
    stack[index].last = marker;
  }
  return stack.length;
}

// ---------------------------------------------------------------------------
// Quoted provisions: amending orders set out replacement text as paragraphs that each
// open with a quotation mark (“(a) OPM shall be responsible for: … ”).

const QUOTE_CLOSED = /”[.;,]?(?: and| or)?$/;

/** Is this paragraph a quoted provision? Returns its own leading marker, if it has one. */
function quotedProvision(text) {
  if (!text.startsWith('“')) return null;
  const rest = text.slice(1).trimStart();
  const marker = markerAt(rest);
  const heading = /^(?:Sec(?:tion)?\b|§)/.test(rest);
  if (marker || heading) return { marker, heading };
  // A short quoted term opening an ordinary sentence (“Agency” means …) is not a quotation.
  const close = text.indexOf('”');
  if (close !== -1 && close <= 80 && close !== text.search(QUOTE_CLOSED)) return null;
  return { marker: null, heading: false };
}

// ---------------------------------------------------------------------------
// Blocks

// "<strong>Sec. 2</strong>." and, for sub-numbered sections, "<strong>Sec. 2.</strong> <strong>1.</strong>".
// Some orders put a spacing entity between the number and the heading.
const SECTION_HEAD = /^<strong>\s*(?:Section|Sec)\s*\.?\s*(\d+(?:\.\d+)*)\s*\.?\s*<\/strong>\s*\.?\s*(?:<strong>\s*(\d+)\s*\.?\s*<\/strong>\s*)?(?:&(?:thinsp|ensp|emsp|nbsp);\s*)*/;
const SECTION_TITLE = /^<em>([^<]*?)<\/em>\s*\.?\s*/;
const PART_HEAD = /^<strong>\s*(PART [\dIVXLC]+(?:&mdash;|—|\s*-\s*)[\s\S]*?)<\/strong>$/;
const ENACTING = /(?:order(?:ed)?(?: as follows)?|follows)\s*:$/;

function paragraphs(html) {
  // Usually one signature block; an order co-signed by someone else has two.
  const signatures = [...html.matchAll(/<div class="signature">[\s\S]*?<\/div>/g)]
    .map(m => [m.index, m.index + m[0].length]);
  const endStart = html.indexOf('<div class="end-matter">');

  const out = [];
  for (const m of html.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)) {
    const attrs = m[1];
    const region =
      endStart !== -1 && m.index > endStart ? 'end'
        : signatures.some(([start, end]) => m.index > start && m.index < end) ? 'signature'
          : 'body';
    out.push({
      region,
      cls: /class="([^"]*)"/.exec(attrs)?.[1] ?? '',
      id: /\bid="([^"]*)"/.exec(attrs)?.[1] ?? null,
      page: Number(/data-page="(\d+)"/.exec(attrs)?.[1]) || null,
      src: m[2]
        .replace(/<span class="printed-page-inline[\s\S]*?<\/span>\s*<span class="printed-page-details[\s\S]*?<\/span>/g, ' ')
        .replace(/<svg[\s\S]*?<\/svg>/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    });
  }
  return out;
}

/**
 * @param {string} html  Federal Register full-text HTML (body_html_url)
 * @param {object} meta  Federal Register API record: document_number, executive_order_number,
 *                       title, signing_date, publication_date, citation, volume, start_page,
 *                       end_page, html_url, body_html_url, pdf_url, president { slug, name }
 */
export function parseExecutiveOrder(html, meta) {
  const preamble = [];
  const sections = [];
  const attachments = [];
  const signature = { name: meta.president?.name ?? null, place: null, date: null };
  const endMatter = {};
  let hasSignature = false;

  const usedIds = new Set();
  const uniqueId = base => {
    let id = base;
    for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
    usedIds.add(id);
    return id;
  };

  let section = null;
  let stack = [];
  let quoteStack = []; // marker nesting inside a run of quoted paragraphs
  let quoteOpen = false; // the quotation has not reached its closing mark yet
  let pendingPart = null;
  let enacted = false;

  const blocks = paragraphs(html);
  const body = blocks.filter(b => b.region === 'body');

  // Marker of the paragraph after this one, for the "(i)" look-ahead.
  const leadingMarker = b => (b && !SECTION_HEAD.test(b.src) ? markerAt(b.src) : null);
  const quotedMarker = b => (b ? markerAt(b.src.replace(/^(?:&ldquo;|“)\s*/, '')) : null);

  for (const block of blocks) {
    if (block.cls.includes('document-graphic')) {
      if (block.region === 'signature') continue; // the signature image
      const src = /<img[^>]*src="([^"]+)"/.exec(block.src)?.[1];
      if (src) attachments.push({ type: 'graphic', src, page: block.page });
      continue;
    }
    if (block.region === 'signature') {
      hasSignature = true;
      const text = stripTags(block.src).replace(/[.,]$/, '');
      if (block.cls.includes('signature-place')) signature.place = text;
      if (block.cls.includes('signature-date')) signature.date = text;
      continue;
    }
    if (block.region === 'end') {
      const text = stripTags(block.src).replace(/^\[|\]$/g, '').trim();
      if (block.cls.includes('frdoc')) endMatter.fr_doc = text;
      if (block.cls.includes('filed')) endMatter.filed = text;
      if (block.cls.includes('billing-code')) endMatter.billing_code = text;
      continue;
    }
    if (!block.id?.startsWith('p-')) continue; // the "Executive Order N of <date>" line above the title

    let src = block.src;

    const part = PART_HEAD.exec(src);
    if (part) {
      pendingPart = stripTags(part[1]);
      continue;
    }

    const head = SECTION_HEAD.exec(src);
    if (head) {
      src = src.slice(head[0].length);
      let title = null;
      const em = SECTION_TITLE.exec(src);
      // An <em> right after the number is the heading only if it ends the way headings do.
      if (em && (/\.\s*$/.test(em[1]) || /<\/em>\s*\./.test(em[0]))) {
        title = decode(em[1]).trim().replace(/\.$/, '');
        src = src.slice(em[0].length);
      }
      const label = head[2] ? `${head[1]}.${head[2]}` : head[1];
      const number = /^\d+$/.test(label) ? Number(label) : label;
      section = { number, title, id: uniqueId(`sec-${label.replace(/\./g, '-')}`), items: [] };
      if (pendingPart) section.part = pendingPart;
      pendingPart = null;
      sections.push(section);
      stack = [];
      quoteStack = [];
      quoteOpen = false;
      if (!src) continue;
    }

    // Leading markers. "(c)(i) text" opens (c) with no text of its own, then (i).
    const markers = [];
    for (let m; (m = MARKER.exec(src)); ) {
      markers.push(m[1]);
      src = src.slice(m[0].length);
    }
    // A numbered list item, unless it continues a quotation that is still open.
    const numbered = markers.length === 0 && !quoteOpen ? NUMBERED.exec(src) : null;
    if (numbered) {
      markers.push(numbered[1]);
      src = src.slice(numbered[0].length);
    }

    if (!section) {
      if (markers.length === 0 && !enacted) {
        const paragraph = { page: block.page, ...inline(src) };
        preamble.push(paragraph);
        if (ENACTING.test(paragraph.text)) enacted = true;
        continue;
      }
      // Body text with no "Section 1" heading: one unnumbered section.
      section = { number: null, title: null, id: uniqueId('sec-0'), items: [] };
      sections.push(section);
    }

    const definitions = /definition/i.test(section.title ?? '') || /^As used in|following definitions/i.test(section.items[0]?.text ?? '');
    if (markers.length === 0) {
      const item = { marker: null, level: 0, page: block.page, ...inline(src, { definitions }) };
      let quote = quotedProvision(item.text);
      // Until the quotation closes, its paragraphs belong to it even without an opening mark
      // of their own (a contract clause followed by "1. …", "2. …").
      if (!quote && quoteOpen) quote = { marker: markerAt(item.text), heading: false };
      if (quote) {
        if (quote.heading) quoteStack = [];
        item.quoted = true;
        // Unmarked quoted paragraphs stay at the depth of the provision they continue.
        item.quote_level = quote.marker
          ? placeMarker(quoteStack, quote.marker, quotedMarker(body[body.indexOf(block) + 1]))
          : quoteStack.length;
        // The marker as printed, "(i)" or "1."; it stays part of the text.
        if (quote.marker) item.quote_marker = quote.marker.endsWith('.') ? quote.marker : `(${quote.marker})`;
        quoteOpen = !QUOTE_CLOSED.test(item.text);
      } else {
        quoteStack = [];
        quoteOpen = false;
      }
      section.items.push(item);
      continue;
    }
    quoteStack = [];
    quoteOpen = false;
    markers.forEach((marker, i) => {
      const isLast = i === markers.length - 1;
      const next = isLast ? leadingMarker(body[body.indexOf(block) + 1]) : markers[i + 1];
      const level = placeMarker(stack, marker, next);
      section.items.push({
        marker,
        level,
        page: block.page,
        ...(isLast ? inline(src, { definitions }) : { text: '', spans: [] }),
      });
    });
  }

  // Citations, each with the provisions that cite it: "1" (unmarked text), "4(c)", "5(a)(i)".
  const citations = [];
  const collect = (spans, address) => {
    for (const span of spans.filter(s => s.type === 'citation')) {
      let citation = citations.find(c => c.href === span.href);
      if (!citation) citations.push(citation = { ...span.target, href: span.href, labels: [], cited_in: [] });
      if (!citation.labels.includes(span.text)) citation.labels.push(span.text);
      if (address && !citation.cited_in.includes(address)) citation.cited_in.push(address);
    }
  };
  preamble.forEach(p => collect(p.spans, 'preamble'));
  for (const s of sections) {
    const path = [];
    for (const item of s.items) {
      if (item.marker) {
        path.length = item.level - 1;
        path[item.level - 1] = item.marker;
      } else {
        path.length = 0;
      }
      collect(item.spans, `${s.number ?? ''}${path.map(p => `(${p.replace(/\.$/, '')})`).join('')}` || 'text');
    }
  }

  return {
    doc_type: 'executive_order',
    number: meta.executive_order_number ? String(meta.executive_order_number) : null,
    title: meta.title,
    president: meta.president ?? null,
    signed_date: meta.signing_date ?? null,
    publication: {
      date: meta.publication_date ?? null,
      citation: meta.citation ?? null,
      volume: meta.volume ?? null,
      start_page: meta.start_page ?? null,
      end_page: meta.end_page ?? null,
      document_number: meta.document_number,
    },
    source: {
      name: 'federal_register',
      html_url: meta.html_url ?? null,
      body_html_url: meta.body_html_url ?? null,
      pdf_url: meta.pdf_url ?? null,
    },
    preamble,
    sections,
    signature: hasSignature ? signature : null,
    end_matter: endMatter,
    citations,
    ...(attachments.length ? { attachments } : {}),
  };
}

// ---------------------------------------------------------------------------
// Fallback for the rare order with no Federal Register HTML: govinfo's plain text
// (see seed/fetch-govinfo-executive-orders.js), rewritten into the same markup so
// the parser above applies. Citations are not linked in this form.

const escapeHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Headings are in title case; body sentences are not.
function looksLikeHeading(sentence) {
  const words = sentence.split(/\s+/).filter(w => w.length > 3);
  return sentence.length <= 140 && words.filter(w => /^[A-Z]/.test(w)).length >= words.length * 0.6;
}

export function govinfoTextToHtml(body) {
  const paragraphs = body.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  while (paragraphs.length && /^(Administration of |Executive Order \d+\s*[-–—]|[A-Z][a-z]+ \d{1,2}, \d{4}$)/.test(paragraphs[0])) {
    paragraphs.shift();
  }
  // The text ends with the signature (name in capitals), then filing notes and index terms.
  const signatureAt = paragraphs.findIndex(p => /^[A-Z][A-Z .]+$/.test(p));
  const text = signatureAt === -1 ? paragraphs : paragraphs.slice(0, signatureAt);
  const [, place, date] = signatureAt === -1 ? [] : paragraphs.slice(signatureAt, signatureAt + 3);

  const html = text.map((paragraph, i) => {
    let p = escapeHtml(paragraph).replace(/"([^"]*)"/g, '“$1”');
    const head = /^(?:Section|Sec\.) (\d+(?:\.\d+)*)\. /.exec(p);
    if (head) {
      const rest = p.slice(head[0].length);
      const title = /^([^.]+)\.(?: |$)/.exec(rest);
      p = title && looksLikeHeading(title[1])
        ? `<strong>Sec. ${head[1]}.</strong> <em>${title[1]}.</em> ${rest.slice(title[0].length)}`
        : `<strong>Sec. ${head[1]}.</strong> ${rest}`;
    }
    return `<p id="p-${i + 1}">${p}</p>`;
  });

  if (place) {
    html.push(
      `<div class="signature"><p class="signature-place">${escapeHtml(place)}</p>` +
      `<p class="signature-date">${escapeHtml(date ?? '')}</p></div>`
    );
  }
  return html.join('\n');
}
