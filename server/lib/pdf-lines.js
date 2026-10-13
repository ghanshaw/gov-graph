/**
 * A PDF → its printed lines, with what the typesetting says about each: where the line
 * starts and ends, its type size, and which runs are italic, bold or raised (footnote marks).
 *
 * Used for documents whose only official form is a PDF (Supreme Court slip opinions; see
 * parse-slip-opinion.js). Nothing here knows about any particular document.
 *
 *   pages: [{ number, lines: [{ x, end, y, size, text, softHyphen, runs: [{ text, italic?, bold?, sup? }] }] }]
 *
 * `number` is the page's position in the file (from 1), not the number printed on it.
 * Lines are in reading order (top to bottom); x / end / y are in PDF points from the bottom left.
 */

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// A footnote mark is set in small type, raised above the line it belongs to.
const MARK = /^[\d*†‡]+$/;

function toLines(items) {
  const rows = [];
  for (const item of items) {
    let row = rows.find(r => Math.abs(r.y - item.y) < 1);
    if (!row) rows.push(row = { y: item.y, items: [] });
    row.items.push(item);
  }
  rows.sort((a, b) => b.y - a.y);

  const inked = row => row.items.filter(i => i.text.trim());
  const size = row => Math.max(...inked(row).map(i => i.size));

  // A row of nothing but a small mark sits just above the baseline of its line: fold it in.
  for (let r = rows.length - 1; r >= 0; r--) {
    const row = rows[r];
    if (!inked(row).length || !MARK.test(inked(row).map(i => i.text.trim()).join(''))) continue;
    const below = rows.find(o => o !== row && inked(o).length && row.y - o.y > 0 && row.y - o.y <= 6 && size(o) > size(row) * 1.2);
    if (!below) continue;
    below.items.push(...inked(row).map(i => ({ ...i, sup: true })));
    rows.splice(r, 1);
  }

  return rows.filter(row => inked(row).length).map(row => {
    const parts = row.items.sort((a, b) => a.x - b.x);
    // The typesetter hangs a line-break hyphen in the margin as a separate piece of text;
    // a hyphen that belongs to the word ("for-cause") is part of the word's own piece.
    const last = inked(row).at(-1);
    const softHyphen = last.text === '-' && inked(row).length > 1;

    const runs = [];
    const push = (text, style = {}) => {
      const prev = runs.at(-1);
      if (prev && !prev.sup === !style.sup && !prev.italic === !style.italic && !prev.bold === !style.bold) prev.text += text;
      else runs.push({ text, ...style });
    };
    let prevEnd = null;
    for (const part of parts) {
      if (softHyphen && part === last) break;
      const text = part.text.replace(/\s+/g, ' ');
      const soFar = runs.map(r => r.text).join('');
      // Wide gaps are not always given a space character (page number beside a running head).
      const gap = prevEnd != null && part.x - prevEnd > part.size * 0.2;
      if (soFar && !/ $/.test(soFar) && (gap || text.startsWith(' '))) push(' ');
      prevEnd = part.x + part.width;
      if (!text.trim()) continue;
      const style = part.sup ? { sup: true } : { ...(part.italic && { italic: true }), ...(part.bold && { bold: true }) };
      push(text.trim(), style);
      if (text.endsWith(' ')) push(' ');
    }
    // Spaces carry no style of their own: " " between two italic words stays inside the run.
    const text = runs.filter(r => !r.sup).map(r => r.text).join('').trim();
    const body = inked(row).filter(i => !i.sup);
    return {
      x: Math.round(Math.min(...inked(row).filter(i => !i.sup || body.length === 0).map(i => i.x)) * 10) / 10,
      end: Math.round((last.x + last.width) * 10) / 10,
      y: Math.round(row.y * 10) / 10,
      size: Math.max(...(body.length ? body : inked(row)).map(i => i.size)),
      text,
      softHyphen,
      runs,
    };
  });
}

/** @param {Buffer|Uint8Array} data the PDF file */
export async function extractPdfLines(data) {
  const task = getDocument({ data: new Uint8Array(data), verbosity: 0 });
  const doc = await task.promise;
  const pages = [];
  for (let number = 1; number <= doc.numPages; number++) {
    const page = await doc.getPage(number);
    const content = await page.getTextContent();
    await page.getOperatorList(); // loads the fonts, whose names say italic / bold
    const fonts = new Map();
    const fontName = id => {
      if (!fonts.has(id)) {
        let name = '';
        try { name = page.commonObjs.get(id)?.name ?? ''; } catch { /* font not loaded: plain */ }
        fonts.set(id, name);
      }
      return fonts.get(id);
    };
    const items = content.items.filter(i => i.str).map(i => ({
      text: i.str,
      x: i.transform[4],
      y: i.transform[5],
      width: i.width,
      size: Math.round(i.transform[3] * 10) / 10,
      italic: /italic|oblique/i.test(fontName(i.fontName)),
      bold: /bold/i.test(fontName(i.fontName)),
    }));
    pages.push({ number, lines: toLines(items) });
  }
  await task.destroy();
  return pages;
}
