/**
 * The Federal Judicial Center's biographical directory (judges.csv, one row per judge with up
 * to six appointments as numbered column groups) → the Justices of the Supreme Court and their
 * service, for people + person_roles.
 *
 * Service on the Court ends at senior status where there is one: a Justice who retires takes
 * senior status, and the directory's termination date is then the date of death (Byron White:
 * senior status 1993, termination 2002). Service starts at the commission date; the directory
 * has no oath date (Ketanji Brown Jackson: commissioned April 8, 2022, sworn in June 30), so
 * which Justices sat on a given day still comes from naturalCourts.js.
 */

/** A small CSV reader: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  const keys = header.map(k => k.replace(/^﻿/, ''));
  return body.filter(r => r.length > 1).map(r => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])));
}

// The directory gives only the year of birth for living judges; a partial date is not stored.
const isoDate = (y, m, d) => (y && m && d ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null);

/**
 * @returns [{ fjcId, name, sortName, firstName, lastName, gender, birthDate, birthYear, deathDate,
 *            roles: [{ roleType: 'justice' | 'chief_justice', start, end, how }] }]
 */
export function justicesFromFjc(csvText) {
  const justices = [];
  for (const r of parseCsv(csvText)) {
    const roles = [];
    for (let n = 1; n <= 6; n++) {
      if (!/Supreme Court/.test(r[`Court Type (${n})`] ?? '')) continue;
      const title = r[`Appointment Title (${n})`];
      roles.push({
        roleType: /Chief Justice/.test(title) ? 'chief_justice' : 'justice',
        start: r[`Commission Date (${n})`] || null,
        end: r[`Senior Status Date (${n})`] || r[`Termination Date (${n})`] || null,
        how: r[`Appointing President (${n})`] ? `appointed by ${r[`Appointing President (${n})`]}` : 'appointment',
      });
    }
    if (!roles.length) continue;
    const first = r['First Name'].trim();
    const middle = r['Middle Name'].trim();
    const last = r['Last Name'].trim();
    const suffix = r['Suffix'].trim();
    justices.push({
      fjcId: r.nid,
      name: [first, middle, last].filter(Boolean).join(' ') + (suffix ? ` ${suffix}` : ''),
      sortName: `${last}, ${[first, middle ? `${middle[0]}.` : ''].filter(Boolean).join(' ')}${suffix ? ` ${suffix}` : ''}`,
      firstName: first,
      lastName: last,
      gender: r.Gender === 'Female' ? 'F' : r.Gender === 'Male' ? 'M' : null,
      birthDate: isoDate(r['Birth Year'], r['Birth Month'], r['Birth Day']),
      birthYear: r['Birth Year'] ? Number(r['Birth Year']) : null,
      deathDate: isoDate(r['Death Year'], r['Death Month'], r['Death Day']),
      roles: roles.sort((a, b) => (a.start ?? '').localeCompare(b.start ?? '')),
    });
  }
  return justices;
}
