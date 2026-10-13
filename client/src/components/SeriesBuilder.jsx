import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_SERIES_DIMENSIONS } from '../queries';
import { buildTree, withoutPath, yearsOf } from '../dimensions';
import { PLACEMENTS, TAXONOMIES, withMeasures } from '../taxonomies';
import TaxonomyTree from './TaxonomyTree';

// The catalogue's Build mode (concept A in design/timeline-data/builder): choose a measure from a category
// taxonomy (TaxonomyTree: the Statistical Abstract or CAP's topics, the measures as leaves), then its options
// as a tree. Choosing an option opens beneath it only what exists for it, so nothing on screen leads nowhere;
// an option alone under its parent is chosen for you. A click chooses, its × takes it out (with what is
// beneath it), and several options may be open at once. The series the choices reach go on the timeline,
// and change as the choices do. What every series shares, then years, then source close the panel. A measure
// with one series is one button, its details in a tooltip; nothing goes on until it is clicked.
const ONE = 'series';

// One option: a square button, with an × once chosen.
function Choice({ v, onPick, onUnpick }) {
  return (
    <span className={`pill choice${v.on ? ' on' : ''}`}>
      <button type="button" className="pick" aria-pressed={v.on} onClick={() => onPick(v.path)}>{v.label}</button>
      {v.on && <button type="button" className="x" aria-label={`Take out ${v.label}`} title="Take out" onClick={() => onUnpick(v.path)}>×</button>}
    </span>
  );
}

// Options with nothing beneath them, on one line; demographic groups and kinds of a value (taxes) on lines of their own.
function Line({ values, onPick, onUnpick }) {
  const groups = [];
  for (const v of values) {
    const key = v.kind ?? (v.depth >= 2 ? v.parent : '');
    let group = groups.find(g => g.key === key);
    if (!group) {
      group = { key, label: v.kind ?? values.find(o => o.value === v.parent)?.label, values: [] };
      groups.push(group);
    }
    group.values.push(v);
  }
  return (
    <div className="tree-line">
      {groups.map((g, i) => (
        <div key={g.key} className={i ? 'facet-line sub' : 'facet-line'}>
          {i > 0 && g.label && <span className="kinds">{g.label}:</span>}
          {g.values.map(v => <Choice key={v.path} v={v} onPick={onPick} onUnpick={onUnpick} />)}
        </div>
      ))}
    </div>
  );
}

// A node: the options chosen for you on the way, then a level of options, each opening its own beneath it.
function Node({ node, onPick, onUnpick }) {
  return (
    <>
      {node.autos.length > 0 && (
        <div className="tree-autos">
          {node.autos.map(a => (
            <span key={a.label}><span className="tree-label">{a.label}</span><span className="pill auto" title="The only one published here">{a.value}</span></span>
          ))}
        </div>
      )}
      {node.level && (
        <div className="tree-level">
          <p className="tree-label">{node.level.label}</p>
          {node.layout === 'line' ? <Line values={node.values} onPick={onPick} onUnpick={onUnpick} /> : (
            <div className="tree-branches">
              {node.values.map(v => (
                <div key={v.path} className="tree-branch" style={{ marginLeft: v.depth * 16 }}>
                  <div className="tree-head">
                    <Choice v={v} onPick={onPick} onUnpick={onUnpick} />
                    {v.preview && <span className="tree-hint">{v.preview}</span>}
                  </div>
                  {v.child && (v.child.level || v.child.autos.length > 0) && (
                    <div className="tree-children"><Node node={v.child} onPick={onPick} onUnpick={onUnpick} /></div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** Props as SeriesSearch's: `bySlug`, `isOn(slugs)`, `onSwap(remove, add)`. */
export default function SeriesBuilder({ bySlug, isOn, onSwap }) {
  const { data, loading, error } = useQuery(GET_SERIES_DIMENSIONS);
  const [measure, setMeasure] = useState(null);
  const [taxonomyId, setTaxonomyId] = useState(TAXONOMIES[0].id);
  // Choices are kept per measure, so going back to one finds them as they were.
  const [pickedBy, setPickedBy] = useState({});
  const vocab = data?.seriesDimensionVocabulary;
  const picked = useMemo(() => pickedBy[measure] ?? new Set(), [pickedBy, measure]);

  const byMeasure = useMemo(() => {
    const groups = new Map();
    for (const s of data?.economicSeriesList ?? []) {
      const stored = bySlug.get(s.slug);
      if (!s.dimensions || !stored) continue;
      groups.set(s.dimensions.measure, [...(groups.get(s.dimensions.measure) ?? []), { ...stored, dimensions: { ...s.dimensions, years: yearsOf(stored) } }]);
    }
    return groups;
  }, [data, bySlug]);
  const series = useMemo(() => (measure ? byMeasure.get(measure) ?? [] : []), [byMeasure, measure]);
  const taxonomy = TAXONOMIES.find(s => s.id === taxonomyId);
  const keys = useMemo(() => Object.keys(data?.seriesDimensionVocabulary?.measures ?? {}).filter(key => byMeasure.has(key)), [data, byMeasure]);
  const categories = useMemo(() => withMeasures(taxonomy, keys), [taxonomy, keys]);
  const tree = useMemo(() => (vocab && measure ? buildTree(vocab, measure, series, picked) : null), [vocab, measure, series, picked]);

  const target = !tree ? [] : tree.automatic ? (picked.has(ONE) ? tree.matches : []) : tree.matches;
  const targetKey = target.join(',');

  // What the builder itself put on, per measure, so it takes off only those.
  const owned = useRef(new Map());
  const latest = useRef({ isOn, onSwap });
  useEffect(() => { latest.current = { isOn, onSwap }; });
  useEffect(() => {
    if (!measure) return;
    const wanted = targetKey ? targetKey.split(',') : [];
    const before = owned.current.get(measure) ?? new Set();
    const add = wanted.filter(slug => !latest.current.isOn([slug]));
    const remove = [...before].filter(slug => !wanted.includes(slug) && latest.current.isOn([slug]));
    owned.current.set(measure, new Set(wanted));
    if (add.length || remove.length) latest.current.onSwap(remove, add);
  }, [measure, targetKey]);

  if (error) return <p className="catalog-empty">Could not load the dimensions: {error.message}</p>;
  if (loading || !vocab) return <p className="catalog-empty">Loading…</p>;

  const setPicked = change => setPickedBy(b => ({ ...b, [measure]: change(b[measure] ?? new Set()) }));
  const pick = path => setPicked(p => new Set(p).add(path));
  const unpick = path => setPicked(p => withoutPath(p, path));
  const onCount = key => (byMeasure.get(key) ?? []).filter(s => isOn([s.slug])).length;
  const label = key => vocab.measures[key]?.label ?? key;
  const name = slug => bySlug.get(slug)?.name ?? slug;
  // On a narrow screen the tree gives way to a list: the measures under each top-level category.
  const groups = categories.categories.map(c => {
    const all = [];
    const walk = node => { all.push(...node.measures); node.children.forEach(walk); };
    walk(c);
    return { name: c.name, keys: all };
  }).filter(g => g.keys.length);
  if (categories.leftOut.length) groups.push({ name: 'Not in this taxonomy', keys: categories.leftOut });
  const path = measure ? categories.pathOf.get(measure) : null;
  const placement = measure ? PLACEMENTS[taxonomyId]?.measures?.[measure] : null;

  return (
    <div className="catalog-body build-body">
      <TaxonomyTree tree={categories} label={label} size={key => byMeasure.get(key)?.length ?? 0} onCount={onCount}
        names={key => (byMeasure.get(key) ?? []).map(s => s.name)} selected={measure} onSelect={setMeasure}
        taxonomyId={taxonomyId} onTaxonomy={setTaxonomyId} />
      <div className="catalog-list builder" data-testid="series-builder">
        <select className="measure-select" aria-label="Measure" value={measure ?? ''} onChange={e => setMeasure(e.target.value || null)}>
          <option value="">Choose what to measure…</option>
          {groups.map(g => (
            <optgroup key={g.name} label={g.name}>{g.keys.map(key => <option key={key} value={key}>{label(key)}</option>)}</optgroup>
          ))}
        </select>
        {!tree ? (
          <p className="catalog-empty">Choose a category on the left and what to measure in it, then narrow it down: how it is measured, which part of it, how often.</p>
        ) : (
          <>
            <p className="builder-path">{path ? path.join(' › ') : `Not in the ${taxonomy.name}`}</p>
            <div className="builder-head">
              <h3>{vocab.measures[measure].label}</h3>
              {picked.size > 0 && <button type="button" className="clear" onClick={() => setPicked(() => new Set())}>Clear choices</button>}
            </div>
            {placement && (
              // Why it sits here: the taxonomy's own tables, or GovGraph's reason.
              <p className="builder-placement">
                {placement.left_out ? <><b>Not in this taxonomy.</b> {placement.reason}</>
                  : placement.basis === 'table' ? `${taxonomy.name} tables ${placement.tables.join(', ')}.`
                    : <><b>Placed by GovGraph.</b> {placement.reason}</>}
              </p>
            )}
            {tree.automatic ? (
              // One series: a button to put it on, what it is in a tooltip.
              <div className="one-series">
                <Choice v={{ label: name(tree.matches[0]), path: ONE, on: picked.has(ONE) }} onPick={pick} onUnpick={unpick} />
                <span className="one-details" role="tooltip">
                  {tree.after.map(a => <span key={a.label}><span className="facet-label">{a.label}</span>{a.values.join(', ')}</span>)}
                </span>
              </div>
            ) : (
              <>
                <div className="tree">
                  <Node node={tree.root} onPick={pick} onUnpick={unpick} />
                </div>
                <div className="tree-after">
                  {tree.after.map(a => (
                    <div key={a.label} className="facet">
                      <span className="facet-label">{a.label}</span>
                      <div className="facet-line"><span className="fact">{a.values.join(', ')}</span></div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {target.length > 0 ? (
              <div className="builder-status">
                <span className="label">On the timeline</span>
                {target.map(slug => <span key={slug} className="chosen">{name(slug)}</span>)}
              </div>
            ) : tree.waiting.length > 0 ? (
              <p className="builder-status">Choose {tree.waiting[0]} to put it on the timeline.</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
