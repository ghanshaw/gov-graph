import { useState } from 'react';
import { TAXONOMIES } from '../taxonomies';
import { COVERAGE_CHIP } from '../sources';

// Build mode's left column (design D.1 in design/timeline-data/build-structures): a taxonomy, the
// Statistical Abstract or CAP's topics, nested as printed, with GovGraph's measures as its leaves. Categories and
// subcategories fold; one with no measures beneath is grey, or hidden with "Only with data". The filter matches
// category names (and CAP's subtopic descriptions), measures and the names of their series; a measure listed only for a
// series name shows the names that matched. Measures a taxonomy leaves out are listed last. In the Statistical Abstract,
// each subsection ends with the tables of it GovGraph holds nothing of ("Not here yet", folded; `missing`), so the
// gaps show where people look; the filter matches their titles too.

const words = q => q.toLowerCase().split(/\s+/).filter(Boolean);
const has = (text, ws) => ws.every(w => text.toLowerCase().includes(w));

function Highlight({ text, ws }) {
  if (!ws.length) return text;
  const re = new RegExp(`(${ws.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig');
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

function Counts({ n, on }) {
  return <span className="st-end">{on > 0 && <b>{on} on</b>}{n > 0 && <span>{n}</span>}</span>;
}

/**
 * `tree`: withMeasures(taxonomy, …). `label(key)`, `size(key)` (series), `onCount(key)` (series on the
 * timeline), `names(key)` (series names, for the filter). `selected` and `onSelect(key)`: the measure chosen.
 * `taxonomyId` and `onTaxonomy(id)`: the taxonomy shown. `missing`: category id → the Abstract's tables there with
 * nothing loaded ({ id, section, title, coverage }), and `coverageLabels` (coverage → label); empty for other taxonomies.
 */
export default function TaxonomyTree({ tree, label, size, onCount, names, selected, onSelect, taxonomyId, onTaxonomy,
  missing = new Map(), coverageLabels = {} }) {
  const [query, setQuery] = useState('');
  const [onlyData, setOnlyData] = useState(false);
  const [closed, setClosed] = useState(new Set());
  const [wantingOpen, setWantingOpen] = useState(new Set());
  const ws = words(query);
  const searching = ws.length > 0;

  const total = node => node.measures.reduce((n, k) => n + size(k), 0) + node.children.reduce((n, c) => n + total(c), 0);
  const totalOn = node => node.measures.reduce((n, k) => n + onCount(k), 0) + node.children.reduce((n, c) => n + totalOn(c), 0);

  // A node as shown: its measures (with the series names that matched) and its children, or null when filtered out.
  const shown = (node, above) => {
    if (onlyData && !total(node)) return null;
    // Descriptions count only at the lowest level (CAP's subtopics): a section's opening paragraph mentions too much.
    const description = node.children.length ? '' : node.description ?? '';
    const hit = above || !searching || has(`${node.name} ${description}`, ws);
    const measures = node.measures.map(key => {
      if (hit || has(label(key), ws)) return { key, hits: [] };
      const hits = names(key).filter(n => has(n, ws));
      return hits.length ? { key, hits } : null;
    }).filter(Boolean);
    const children = node.children.map(c => shown(c, hit && searching)).filter(Boolean);
    const wanting = (missing.get(node.id) ?? []).filter(t => hit || has(t.title, ws));
    return measures.length || children.length || wanting.length || hit ? { node, measures, children, wanting } : null;
  };
  const roots = tree.categories.map(c => shown(c, false)).filter(Boolean);
  const leftOut = tree.leftOut.map(key => (!searching || has(label(key), ws) ? { key, hits: [] } : null)).filter(Boolean);

  const toggle = id => setClosed(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allIds = [];
  const collect = cats => { for (const c of cats) { allIds.push(c.id); collect(c.children); } };
  collect(tree.categories);
  const subcategories = tree.categories.flatMap(c => c.children);

  // Render functions, not components, so the tree is not remounted on every change.
  const leaf = m => (
    <li key={m.key} className={m.key === selected ? 'st-leaf on' : 'st-leaf'}>
      <button type="button" aria-current={m.key === selected || undefined} onClick={() => onSelect(m.key)}>
        <span className="st-name"><Highlight text={label(m.key)} ws={ws} /></span>
        <Counts n={size(m.key)} on={onCount(m.key)} />
      </button>
      {m.hits.length > 0 && (
        <span className="st-hits">
          {m.hits.slice(0, 3).map(h => <span key={h}><Highlight text={h} ws={ws} /></span>)}
          {m.hits.length > 3 && <span>+ {m.hits.length - 3} more</span>}
        </span>
      )}
    </li>
  );
  // The tables of a category not here yet: one folded line, opened to the list (opened by itself when the filter
  // matched a title). Each links to the coverage report, in a new tab so the timeline keeps its state.
  const wantingLine = (node, tables) => {
    const open = wantingOpen.has(node.id) || (searching && tables.some(t => has(t.title, ws)));
    const toggleWanting = () => setWantingOpen(prev => {
      const next = new Set(prev);
      if (next.has(node.id)) next.delete(node.id); else next.add(node.id);
      return next;
    });
    return (
      <li key="wanting" className="st-wanting">
        <button type="button" className="category-name" aria-expanded={open} onClick={toggleWanting}>
          <span className="st-name">Not here yet</span>
          <span className="st-end"><span>{tables.length} {tables.length === 1 ? 'table' : 'tables'}</span></span>
        </button>
        {open && (
          <ul className="st-tables">
            {tables.map(t => (
              <li key={t.id}>
                <a href={`/sources/abstract-coverage?section=${t.section}`} target="_blank" rel="noopener noreferrer"
                  title="This table on the coverage report">
                  <span className="st-table-no">{t.id}</span>
                  <span className="st-name"><Highlight text={t.title} ws={ws} /></span>
                </a>
                <span className={COVERAGE_CHIP[t.coverage] ?? 'chip'}>{coverageLabels[t.coverage] ?? t.coverage}</span>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  const branch = s => {
    const { node } = s;
    const n = total(node);
    const open = searching || !closed.has(node.id);
    const foldable = s.measures.length > 0 || s.children.length > 0 || s.wanting.length > 0;
    return (
      <li key={node.id} className={n ? undefined : 'st-empty'}>
        {foldable ? (
          <button type="button" className="category-name" aria-expanded={open} onClick={() => toggle(node.id)}>
            <span className="st-name"><Highlight text={node.name} ws={ws} /></span>
            <Counts n={n} on={open ? 0 : totalOn(node)} />
          </button>
        ) : (
          <span className="category-name leaf"><span className="st-name"><Highlight text={node.name} ws={ws} /></span></span>
        )}
        {foldable && open && (
          <ul className="category-tree">
            {s.measures.map(leaf)}
            {s.children.map(branch)}
            {s.wanting.length > 0 && wantingLine(node, s.wanting)}
          </ul>
        )}
      </li>
    );
  };

  return (
    <nav className="taxonomy-tree" aria-label="Categories">
      <div className="st-controls">
        <span className="st-taxonomies" role="group" aria-label="Taxonomy">
          {TAXONOMIES.map(s => (
            <button key={s.id} type="button" className={s.id === taxonomyId ? 'on' : undefined} aria-pressed={s.id === taxonomyId}
              onClick={() => { onTaxonomy(s.id); setClosed(new Set()); }}>{s.id === 'comparative-agendas' ? 'Policy topics (CAP)' : s.name}</button>
          ))}
        </span>
        <input type="search" className="st-find" value={query} aria-label="Filter categories, measures and series"
          placeholder="Filter categories, measures and series…" onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setQuery(''); } }} />
        <div className="st-row">
          <label className="st-only"><input type="checkbox" checked={onlyData} onChange={e => setOnlyData(e.target.checked)} />
            Only with data <span>{subcategories.filter(total).length} of {subcategories.length}</span></label>
          <span className="st-fold">
            <button type="button" title="Fold all" aria-label="Fold all" onClick={() => setClosed(new Set(allIds))}>−</button>
            <button type="button" title="Open all" aria-label="Open all" onClick={() => setClosed(new Set())}>+</button>
          </span>
        </div>
      </div>
      <div className="st-scroll">
        {!roots.length && !leftOut.length && <p className="catalog-empty">Nothing matches “{query}”.</p>}
        <ul className="category-tree top">
          {roots.map(branch)}
          {leftOut.length > 0 && (
            <li className="st-left-out">
              <span className="category-name leaf"><span className="st-name">Not in this taxonomy</span></span>
              <ul className="category-tree">{leftOut.map(leaf)}</ul>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}
