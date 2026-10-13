/**
 * A govinfo bill status file (BILLSTATUS-119hr1.xml) → the fields this project stores:
 * the bill's identity and headline facts, a `details` object, and its actions.
 * See https://www.govinfo.gov/bulkdata/BILLSTATUS and seed/load-bill-status-bulk.js.
 */

import { parseXml, child, plain, isElement } from './parse-bill-xml.js';

const items = node => (node ? node.children.filter(c => isElement(c) && c.name === 'item') : []);
const text = (node, name) => (node ? plain(child(node, name)) || null : null);
const day = value => (/^\d{4}-\d{2}-\d{2}/.test(value ?? '') ? value.slice(0, 10) : null);

export function parseBillStatus(xml) {
  const root = parseXml(xml).children.find(isElement);
  const bill = root && child(root, 'bill');
  if (!bill) throw new Error('not a bill status file');

  // Files written before format version 3 call these billType and billNumber.
  const type = text(bill, 'type') ?? text(bill, 'billType');
  const number = text(bill, 'number') ?? text(bill, 'billNumber');
  const congress = Number(text(bill, 'congress'));
  if (!type || !number || !congress) throw new Error('bill status file without congress, type or number');

  const actions = items(child(bill, 'actions')).map((a, position) => ({
    position, // as published: newest first
    date: day(text(a, 'actionDate')),
    time: text(a, 'actionTime'),
    text: text(a, 'text'),
    type: text(a, 'type'),
    code: text(a, 'actionCode'),
    source: text(child(a, 'sourceSystem'), 'name'),
  }));

  // Roll calls taken on the bill, as its actions refer to them (each is listed by more than
  // one action), and those taken on amendments to it, which the amendments list separately.
  const recordedVotes = new Map();
  const collect = (node, extra) => {
    for (const c of node.children) {
      if (!isElement(c)) continue;
      if (c.name !== 'recordedVote') { collect(c, extra); continue; }
      const url = text(c, 'url');
      if (!url || recordedVotes.has(url)) continue;
      recordedVotes.set(url, {
        url,
        chamber: text(c, 'chamber'),
        congress: Number(text(c, 'congress')) || congress,
        session: Number(text(c, 'sessionNumber')) || null,
        rollNumber: Number(text(c, 'rollNumber')) || null,
        date: day(text(c, 'date')),
        ...extra,
      });
    }
  };
  for (const [position, action] of items(child(bill, 'actions')).entries()) {
    collect(action, { actionPosition: position, amendment: null });
  }
  const amendments = child(bill, 'amendments');
  for (const a of amendments ? amendments.children.filter(c => isElement(c) && c.name === 'amendment') : []) {
    // e.g. "SAMDT 2849": the amendment's own type and number
    collect(a, { actionPosition: null, amendment: [text(a, 'type'), text(a, 'number')].filter(Boolean).join(' ') || null });
  }

  const laws = items(child(bill, 'laws')).map(l => ({ type: text(l, 'type'), number: text(l, 'number') }));
  const latest = child(bill, 'latestAction');
  const textVersions = items(child(bill, 'textVersions')).map(v => ({
    label: text(v, 'type'),
    date: day(text(v, 'date')),
    packageId: /(BILLS-[0-9a-z]+)/.exec(plain(child(v, 'formats')))?.[1] ?? null,
  }));

  // Sponsor and cosponsors as printed on the bill, with the party and state they had then.
  // Only the bill's own lists: each amendment has sponsors and cosponsors of its own.
  const member = (s, role, position) => ({
    role,
    position,
    bioguideId: text(s, 'bioguideId'),
    fullName: text(s, 'fullName'),
    party: text(s, 'party'),
    state: text(s, 'state'),
    district: text(s, 'district'),
    date: day(text(s, 'sponsorshipDate')),
    isOriginal: role === 'cosponsor' ? text(s, 'isOriginalCosponsor') === 'True' : null,
    withdrawnDate: day(text(s, 'sponsorshipWithdrawnDate')),
  });
  const sponsorships = [
    ...items(child(bill, 'sponsors')).map((s, i) => member(s, 'sponsor', i)),
    ...items(child(bill, 'cosponsors')).map((s, i) => member(s, 'cosponsor', i)),
  ].filter(s => s.bioguideId);

  // Bills Congress.gov relates to this one, each with the kinds of relationship ("Identical bill",
  // "Related bill", "Procedurally related", …) and who identified them (CRS, House, Senate, GPO),
  // in Congress.gov's own wording. A related bill may belong to another Congress.
  const relatedBills = items(child(bill, 'relatedBills')).map(r => ({
    congress: Number(text(r, 'congress')) || null,
    type: text(r, 'type')?.toLowerCase() ?? null,
    number: text(r, 'number'),
    title: text(r, 'title'),
    relationships: items(child(r, 'relationshipDetails'))
      .map(d => ({ type: text(d, 'type'), identifiedBy: text(d, 'identifiedBy') }))
      .filter(d => d.type),
  })).filter(r => r.congress && r.type && r.number && r.relationships.length);

  // Every title the bill has been known by, in Congress.gov's wording and order: display, official
  // and short titles at each stage, short titles of portions, and any popular title CRS gives it.
  const titles = items(child(bill, 'titles'))
    .map((t, position) => ({ position, type: text(t, 'titleType'), title: text(t, 'title'), chamber: text(t, 'chamberName') }))
    .filter(t => t.type && t.title);

  return {
    sourceId: `${congress}-${type.toUpperCase()}-${number}`,
    congress,
    type: type.toLowerCase(),
    number,
    title: text(bill, 'title'),
    introducedDate: day(text(bill, 'introducedDate')),
    publicLawNumber: laws.find(l => l.type === 'Public Law')?.number ?? null,
    enactedDate: actions.find(a => a.type === 'BecameLaw')?.date ?? null,
    status: text(latest, 'text'),
    details: {
      updateDate: text(bill, 'updateDateIncludingText') ?? text(bill, 'updateDate'),
      url: text(bill, 'legislationUrl'),
      originChamber: text(bill, 'originChamber'),
      sponsors: items(child(bill, 'sponsors')).map(s => ({
        bioguideId: text(s, 'bioguideId'), fullName: text(s, 'fullName'), party: text(s, 'party'), state: text(s, 'state'),
      })),
      cosponsorCount: items(child(bill, 'cosponsors')).length,
      policyArea: text(child(bill, 'policyArea'), 'name'),
      committees: items(child(bill, 'committees')).map(c => text(c, 'name')).filter(Boolean),
      latestAction: latest ? { date: day(text(latest, 'actionDate')), text: text(latest, 'text') } : null,
      laws,
      textVersions,
    },
    actions,
    sponsorships,
    recordedVotes: [...recordedVotes.values()],
    relatedBills,
    titles,
  };
}
