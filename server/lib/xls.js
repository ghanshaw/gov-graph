// Reading the first worksheet of an old binary Excel file (.xls: BIFF8 records inside a compound
// file) as rows of strings, without a spreadsheet library, as xlsx.js does for .xlsx. The IRS
// Statistics of Income historical tables are published this way. Only cell values are read
// (numbers, text, formula results); formatting, dates and merged cells are not.

import fs from 'fs';

const END_OF_CHAIN = 0xfffffffe;

/** The compound file's stream named `name` ("Workbook", or "Book" in older files) → Buffer. */
function cfbStream(buf, names) {
  if (buf.readUInt32LE(0) !== 0xe011cfd0) throw new Error('not a compound file (.xls)');
  const sectorSize = 1 << buf.readUInt16LE(0x1e);
  const miniSize = 1 << buf.readUInt16LE(0x20);
  const sector = n => buf.subarray((n + 1) * sectorSize, (n + 2) * sectorSize);

  // The FAT's sectors: 109 listed in the header, the rest in a chain of DIFAT sectors.
  const fatSectors = [];
  for (let i = 0; i < 109; i++) fatSectors.push(buf.readUInt32LE(0x4c + i * 4));
  for (let d = buf.readUInt32LE(0x44), n = buf.readUInt32LE(0x48); n > 0 && d < END_OF_CHAIN; n--) {
    const s = sector(d);
    for (let i = 0; i < sectorSize / 4 - 1; i++) fatSectors.push(s.readUInt32LE(i * 4));
    d = s.readUInt32LE(sectorSize - 4);
  }
  const fat = [];
  for (const f of fatSectors.slice(0, buf.readUInt32LE(0x2c))) {
    const s = sector(f);
    for (let i = 0; i < sectorSize / 4; i++) fat.push(s.readUInt32LE(i * 4));
  }
  const chain = (start, table) => {
    const out = [];
    for (let n = start; n < END_OF_CHAIN && out.length <= table.length; n = table[n]) out.push(n);
    return out;
  };
  const read = start => Buffer.concat(chain(start, fat).map(sector));

  const dir = read(buf.readUInt32LE(0x30));
  const entries = [];
  for (let at = 0; at + 128 <= dir.length; at += 128) {
    const len = dir.readUInt16LE(at + 0x40);
    entries.push({
      name: dir.toString('utf16le', at, at + Math.max(0, len - 2)),
      type: dir[at + 0x42],
      start: dir.readUInt32LE(at + 0x74),
      size: dir.readUInt32LE(at + 0x78),
    });
  }
  const entry = entries.find(e => e.type === 2 && names.includes(e.name));
  if (!entry) throw new Error(`no ${names.join(' or ')} stream`);
  if (entry.size >= buf.readUInt32LE(0x38)) return read(entry.start).subarray(0, entry.size);

  // A small stream lives in the mini stream (the root entry's), in 64-byte mini sectors.
  const miniStream = read(entries[0].start);
  const miniFat = [];
  const mf = read(buf.readUInt32LE(0x3c));
  for (let i = 0; i < mf.length / 4; i++) miniFat.push(mf.readUInt32LE(i * 4));
  return Buffer.concat(chain(entry.start, miniFat).map(n => miniStream.subarray(n * miniSize, (n + 1) * miniSize)))
    .subarray(0, entry.size);
}

/**
 * Bytes spread over a record and its CONTINUE records. Character data that crosses into a
 * CONTINUE starts again with an option byte (whether the rest is one or two bytes a character).
 */
class Segments {
  constructor(parts) { this.parts = parts; this.i = 0; this.at = 0; }
  get left() { return this.parts[this.i].length - this.at; }
  next() { this.i++; this.at = 0; }
  byte() { if (!this.left) this.next(); return this.parts[this.i][this.at++]; }
  u16() { return this.byte() | (this.byte() << 8); }
  u32() { return (this.u16() | (this.u16() << 16)) >>> 0; }
  skip(n) { for (; n > 0; n--) this.byte(); }
  chars(count, high) {
    let out = '';
    while (count > 0) {
      if (!this.left) { this.next(); high = this.byte() & 1; }
      const take = Math.min(count, high ? Math.floor(this.left / 2) : this.left);
      const part = this.parts[this.i];
      out += high ? part.toString('utf16le', this.at, this.at + take * 2) : part.toString('latin1', this.at, this.at + take);
      this.at += take * (high ? 2 : 1);
      count -= take;
    }
    return out;
  }
  /** XLUnicodeRichExtendedString (the shared strings). */
  richString() {
    const count = this.u16();
    const flags = this.byte();
    const runs = flags & 0x08 ? this.u16() : 0;
    const ext = flags & 0x04 ? this.u32() : 0;
    const text = this.chars(count, flags & 0x01);
    this.skip(runs * 4 + ext);
    return text;
  }
}

/** An RK number: a 30-bit integer or the top of a double, maybe ×100. */
function rk(v) {
  let n;
  if (v & 0x02) n = v >> 2;
  else {
    const b = Buffer.alloc(8);
    b.writeUInt32LE((v & 0xfffffffc) >>> 0, 4);
    n = b.readDoubleLE(0);
  }
  return v & 0x01 ? n / 100 : n;
}

/** The first worksheet → rows (arrays of trimmed strings; empty cells are ''), as readXlsx returns them. */
export function readXls(file) {
  const stream = cfbStream(fs.readFileSync(file), ['Workbook', 'Book']);
  const records = [];
  for (let at = 0; at + 4 <= stream.length;) {
    const type = stream.readUInt16LE(at);
    const len = stream.readUInt16LE(at + 2);
    records.push({ type, at, data: stream.subarray(at + 4, at + 4 + len) });
    at += 4 + len;
  }

  const shared = [];
  let firstSheet = null;
  for (let r = 0; r < records.length; r++) {
    const { type, data } = records[r];
    if (type === 0x0085 && firstSheet === null) firstSheet = data.readUInt32LE(0); // BOUNDSHEET: where the sheet's BOF is
    if (type === 0x00fc) { // SST, continued in CONTINUE records
      const parts = [data.subarray(8)];
      while (records[r + 1]?.type === 0x003c) parts.push(records[++r].data);
      const seg = new Segments(parts);
      const unique = data.readUInt32LE(4);
      for (let i = 0; i < unique; i++) shared.push(seg.richString());
    }
  }
  if (firstSheet === null) throw new Error(`${file}: no worksheet`);

  const rows = [];
  const set = (row, col, value) => {
    while (rows.length <= row) rows.push([]);
    rows[row][col] = String(value).trim();
  };
  for (let r = records.findIndex(x => x.at === firstSheet) + 1; r > 0 && r < records.length; r++) {
    const { type, data } = records[r];
    if (type === 0x000a) break; // EOF
    const row = data.length >= 4 ? data.readUInt16LE(0) : 0;
    const col = data.length >= 4 ? data.readUInt16LE(2) : 0;
    if (type === 0x00fd) set(row, col, shared[data.readUInt32LE(6)] ?? ''); // LABELSST
    else if (type === 0x0203) set(row, col, data.readDoubleLE(6)); // NUMBER
    else if (type === 0x027e) set(row, col, rk(data.readUInt32LE(6))); // RK
    else if (type === 0x00bd) { // MULRK: several RK cells in one row
      const last = data.readUInt16LE(data.length - 2);
      for (let c = col, at = 4; c <= last; c++, at += 6) set(row, c, rk(data.readUInt32LE(at + 2)));
    } else if (type === 0x0204) { // LABEL
      const seg = new Segments([data.subarray(6)]);
      const count = seg.u16();
      set(row, col, seg.chars(count, seg.byte() & 1));
    } else if (type === 0x0006) { // FORMULA: its cached result
      if (data.readUInt16LE(12) !== 0xffff) set(row, col, data.readDoubleLE(6));
      else if (data[6] === 0 && records[r + 1]?.type === 0x0207) { // a string, in the STRING record after it
        const seg = new Segments([records[r + 1].data]);
        const count = seg.u16();
        set(row, col, seg.chars(count, seg.byte() & 1));
      }
    }
  }
  return rows.map(cells => Array.from(cells, c => c ?? ''));
}
