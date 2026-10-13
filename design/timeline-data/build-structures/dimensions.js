// Copied verbatim from client/src/dimensions.js (2026-10-13) so the mock runs the app's own Build tree.
// The options of one measure as a tree, for DatasetBuilder (concept A in design/timeline-data/builder):
// each choice opens beneath it only what exists for it, so an option that does not apply is never on
// screen ("Dollars of the day" lives under "An amount" only; GDP's growth rate is published only
// adjusted for inflation). The dimensions come from server/lib/series-dimensions.js.
//
// Levels follow the dimensions in order: how it is measured, the measure's breakdowns (sex, race, age and
// education together as Demographics), dollars, how often, seasonal adjustment, year, years covered,
// source. A dimension is a level only where it splits datasets the levels before it leave together;
// one the whole measure shares, or one the levels before it settle (a group's years), is shown after the
// tree instead, source last. Under a choice, a level with one option is chosen for you.

// What a missing value means, per dimension.
export const ABSENT = {
  sex: 'Everyone', race: 'Everyone', age: 'All ages', education: 'All levels', payment: 'However paid', bound: 'One rate', flow: 'Not stated',
};
const DEMOGRAPHIC = ['sex', 'race', 'age', 'education'];
// Demographic groups by what they combine, in this order, each kind on a line of its own.
const KINDS = [['', 'Everyone'], ['sex', 'Sex'], ['race', 'Race and ethnicity'], ['race sex', 'Race and sex'], ['age', 'Age'],
  ['age sex', 'Age and sex'], ['age race', 'Age and race'], ['age race sex', 'Age, race and sex'], ['education', 'Education'],
  ['education sex', 'Education and sex']];
const ORDER = ['form', 'MEASURE', 'adjustment', 'frequency', 'seasonal', 'year', 'years', 'publisher'];
const SEP = '\u001f';

const yearOf = iso => Number(iso?.slice(0, 4));
/** The years a series covers ("1913–2026"), its `years` dimension. */
export const yearsOf = s => `${yearOf(s.firstDate)}–${yearOf(s.lastDate)}`;

const distinct = values => [...new Set(values)];

function ancestors(values, value) {
  const chain = [];
  for (let v = values?.[value]?.parent; v; v = values[v]?.parent) chain.push(v);
  return chain;
}

// A demographic group as one value: "women|black||", read as "Black women".
function demographicsLevel(vocab) {
  const label = (d, v) => vocab.dimensions[d].values[v]?.label ?? v;
  const valueOf = s => DEMOGRAPHIC.map(d => s.dimensions[d] ?? '').join('|');
  const kindKey = v => DEMOGRAPHIC.filter((d, i) => v.split('|')[i]).sort().join(' ');
  const labelOf = v => {
    const [sex, race, age, education] = v.split('|').map((x, i) => (x ? label(DEMOGRAPHIC[i], x) : null));
    // "Black women", then the age and education: "Black women, 16–19"; "Ages 20–24"; "Men, college graduates".
    const who = race ? (sex ? `${race} ${sex.toLowerCase()}` : race) : sex;
    let text = who;
    if (age) text = text ? `${text}, ${age}` : `Ages ${age}`;
    if (education) text = text ? `${text}, ${education.toLowerCase()}` : education;
    return text ?? 'Everyone';
  };
  const rank = v => {
    const i = KINDS.findIndex(([k]) => k === kindKey(v));
    return i === -1 ? KINDS.length : i;
  };
  const position = v => v.split('|').map((x, i) => (x ? Object.keys(vocab.dimensions[DEMOGRAPHIC[i]].values).indexOf(x) : -1));
  const compare = (a, b) => {
    const [pa, pb] = [position(a), position(b)];
    for (let i = pa.length - 1; i >= 0; i--) if (pa[i] !== pb[i]) return pa[i] - pb[i];
    return 0;
  };
  return {
    key: 'demographics', label: 'Demographics', valueOf, labelOf,
    order: values => [...values].sort((a, b) => (rank(a) - rank(b)) || compare(a, b)),
    kindOf: v => KINDS.find(([k]) => k === kindKey(v))?.[1] ?? 'Combined',
    depthOf: () => 0, parentOf: () => null,
  };
}

function plainLevel(vocab, dim) {
  const values = dim === 'years' ? null : vocab.dimensions[dim].values;
  const keys = values ? Object.keys(values) : [];
  return {
    key: dim,
    label: dim === 'years' ? 'Years' : vocab.dimensions[dim].label,
    valueOf: s => s.dimensions[dim] ?? null,
    labelOf: v => (v === null ? ABSENT[dim] ?? 'Not stated' : values?.[v]?.label ?? v),
    order: vs => [...vs].sort((a, b) => (a === null ? -1 : b === null ? 1 : values ? keys.indexOf(a) - keys.indexOf(b) : String(a).localeCompare(String(b)))),
    depthOf: (v, present) => ancestors(values, v).filter(a => present.has(a)).length,
    parentOf: v => values?.[v]?.parent ?? null,
  };
}

/** The measure's levels in order, and what is shown after the tree: shared by all, or settled by the levels. */
function levelsFor(vocab, measure, series) {
  const all = [];
  for (const slot of ORDER) {
    if (slot !== 'MEASURE') { all.push(plainLevel(vocab, slot)); continue; }
    let demographics = false;
    for (const dim of measure.dims) {
      if (ORDER.includes(dim)) continue;
      if (!DEMOGRAPHIC.includes(dim)) { all.push(plainLevel(vocab, dim)); continue; }
      if (!demographics) { demographics = true; all.push(demographicsLevel(vocab)); }
    }
  }
  const levels = [];
  const after = [];
  for (const level of all) {
    const values = distinct(series.map(level.valueOf));
    if (values.length === 1) {
      if (values[0] !== null && values[0] !== '|||') after.push({ level, shared: true });
      continue;
    }
    // Does it split datasets the levels so far leave together?
    const groups = new Map();
    for (const s of series) {
      const key = levels.map(l => l.valueOf(s)).join(SEP);
      groups.set(key, (groups.get(key) ?? new Set()).add(level.valueOf(s)));
    }
    if ([...groups.values()].some(g => g.size > 1)) levels.push(level);
    else after.push({ level, shared: false });
  }
  return { levels, after };
}

/**
 * The tree for one measure. `series`: [{ slug, dimensions (with `years`) }]. `picked`: Set of paths chosen.
 * Returns { root, matches: [slug] reached through the choices, waiting: [level labels still to choose],
 * automatic: the measure has nothing to choose, after: [{ label, values: [label] }] shown below the tree }.
 * A node: { autos: [{ label, value }] chosen for you, level: { key, label } | null, layout: 'line' | 'branches',
 * values: [{ value, label, path, on, depth, parent, kind, preview, child }] }; a node with no level is a leaf.
 */
export function buildTree(vocab, measureKey, series, picked) {
  const measure = vocab.measures[measureKey];
  const { levels, after } = levelsFor(vocab, measure, series);
  const matches = [];
  const waiting = [];

  // The first level from `i` that splits `ds`, after the ones with a single value there.
  const settle = (i, ds) => {
    const autos = [];
    while (i < levels.length) {
      const values = distinct(ds.map(levels[i].valueOf));
      if (values.length > 1) break;
      autos.push({ level: levels[i], value: values[0] });
      i++;
    }
    return { i, autos };
  };
  const shown = a => a.value !== null && a.value !== '|||' && a.level.key !== 'years';
  // What opens under a closed option, so its difference shows before it is chosen.
  const preview = (i, ds) => {
    const next = settle(i, ds);
    if (next.i === levels.length) {
      const only = next.autos.find(shown);
      return only ? `only ${only.level.labelOf(only.value).toLowerCase()}` : null;
    }
    const level = levels[next.i];
    const values = level.order(distinct(ds.map(level.valueOf)));
    return values.length <= 4 ? values.map(v => level.labelOf(v)).join(' · ') : `${values.length} ${level.label.toLowerCase()}`;
  };

  const node = (start, ds, path) => {
    const { i, autos } = settle(start, ds);
    const prefix = [...path, ...autos.map(a => `${a.level.key}=${a.value}`)];
    const shownAutos = autos.filter(shown).map(a => ({ label: a.level.label, value: a.level.labelOf(a.value) }));
    if (i === levels.length) {
      matches.push(...ds.map(s => s.slug));
      return { autos: shownAutos, level: null };
    }
    const level = levels[i];
    const present = new Set(ds.map(level.valueOf));
    const values = level.order([...present]).map(value => {
      const under = ds.filter(s => level.valueOf(s) === value);
      const p = [...prefix, `${level.key}=${value}`].join(SEP);
      const on = picked.has(p);
      return {
        value, label: level.labelOf(value), path: p, on, kind: level.kindOf?.(value) ?? null,
        depth: level.depthOf(value, present), parent: present.has(level.parentOf(value)) ? level.parentOf(value) : null,
        preview: on ? null : preview(i + 1, under), child: on ? node(i + 1, under, p.split(SEP)) : null,
        settled: settle(i + 1, under).i === levels.length,
      };
    });
    if (!values.some(v => v.on)) waiting.push(level.label.toLowerCase());
    // Options with nothing beneath them read as one line; otherwise each is a branch with what opens under it.
    const layout = values.every(v => v.settled) ? 'line' : 'branches';
    return { autos: shownAutos, level: { key: level.key, label: level.label }, layout, values };
  };

  const root = node(0, series, []);
  const chosen = new Set(matches);
  const of = chosen.size ? series.filter(s => chosen.has(s.slug)) : series;
  return {
    root, matches, waiting: distinct(waiting), automatic: !levels.length,
    after: after.map(({ level, shared }) => ({
      label: level.label,
      values: (shared ? [level.valueOf(series[0])] : level.order(distinct(of.map(level.valueOf))))
        .filter(v => v !== null && v !== '|||').map(v => level.labelOf(v)),
    })).filter(a => a.values.length),
  };
}

/** Take a path out, with everything chosen beneath it. */
export function withoutPath(picked, path) {
  return new Set([...picked].filter(p => p !== path && !p.startsWith(`${path}${SEP}`)));
}
