/**
 * The @unitedstates lists of members of Congress and of presidents and vice presidents
 * (https://github.com/unitedstates/congress-legislators) → people and their roles.
 *
 * One entry per person, with ids from many systems and one term per election (a House term is
 * two years, a Senate term six). A term during which the member changed party lists the dates in
 * `party_affiliations`; such a term becomes one role per party. See seed/load-people.js.
 */

// Ids given a column of their own in `people`; the rest go to `other_ids`.
const ID_COLUMNS = { bioguide: 'bioguideId', lis: 'lisId', wikidata: 'wikidataId' };

const ROLE_TYPES = {
  rep: { roleType: 'representative', chamber: 'House' },
  sen: { roleType: 'senator', chamber: 'Senate' },
  prez: { roleType: 'president', chamber: null },
  viceprez: { roleType: 'vice_president', chamber: null },
};

function names(name) {
  const first = name.nickname ?? name.first;
  const display = name.official_full ?? [first, name.middle && !name.nickname ? name.middle : null, name.last]
    .filter(Boolean).join(' ') + (name.suffix ? `, ${name.suffix}` : '');
  return {
    name: display,
    sortName: `${name.last}, ${[first, name.suffix].filter(Boolean).join(' ')}`,
    firstName: first,
    lastName: name.last,
  };
}

function rolesOf(term) {
  const kind = ROLE_TYPES[term.type];
  if (!kind) throw new Error(`unknown term type ${term.type}`);
  const base = {
    ...kind,
    start: term.start,
    end: term.end ?? null,
    party: term.party ?? null,
    caucus: term.caucus ?? null,
    state: term.state ?? null,
    // -1 marks a historical at-large seat (0 is the modern at-large seat)
    district: term.type === 'rep' && term.district != null && term.district >= 0 ? term.district : null,
    senateClass: term.class ?? null,
    how: term.how ?? null,
  };
  if (!term.party_affiliations?.length) return [base];
  return term.party_affiliations.map(a => ({
    ...base, start: a.start, end: a.end, party: a.party, caucus: a.caucus ?? null,
  }));
}

/** One list entry → { person, roles } */
export function parseLegislator(entry) {
  const ids = entry.id ?? {};
  const person = { ...names(entry.name), gender: entry.bio?.gender ?? null, birthDate: entry.bio?.birthday ?? null };
  const otherIds = {};
  for (const [key, value] of Object.entries(ids)) {
    if (ID_COLUMNS[key]) person[ID_COLUMNS[key]] = String(value);
    else otherIds[key] = value;
  }
  for (const column of Object.values(ID_COLUMNS)) person[column] ??= null;
  person.otherIds = otherIds;
  const roles = (entry.terms ?? []).flatMap(rolesOf).sort((a, b) => a.start.localeCompare(b.start));
  return { person, roles };
}

/**
 * All lists → one record per person. An entry in a later list that shares a Bioguide or
 * Wikidata id with an earlier one is the same person: its roles are added (Joe Biden is a
 * senator in the legislators list, and vice president and president in the executive list).
 */
export function mergePeople(...lists) {
  const people = [];
  const byKey = new Map();
  for (const entry of lists.flat()) {
    const record = parseLegislator(entry);
    const keys = [record.person.bioguideId && `b:${record.person.bioguideId}`, record.person.wikidataId && `w:${record.person.wikidataId}`]
      .filter(Boolean);
    const existing = keys.map(k => byKey.get(k)).find(Boolean);
    if (existing) {
      existing.roles = [...existing.roles, ...record.roles].sort((a, b) => a.start.localeCompare(b.start));
      for (const [key, value] of Object.entries(record.person)) {
        if (key === 'otherIds') existing.person.otherIds = { ...value, ...existing.person.otherIds };
        else existing.person[key] ??= value;
      }
    } else {
      people.push(record);
    }
    const target = existing ?? record;
    for (const k of keys) byKey.set(k, target);
  }
  return people;
}
