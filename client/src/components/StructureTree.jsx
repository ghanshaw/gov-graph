import { useState } from 'react';
import { STRUCTURES } from '../structures';

// Build mode's left column (design D.1 in design/timeline-data/build-structures): a category structure, the
// Statistical Abstract or CAP's topics, nested as printed, with GovGraph's measures as its leaves. Categories and
// subcategories fold; one with no measures beneath is grey, or hidden with "Only with data". The filter matches
// category names (and CAP's subtopic descriptions), measures and the names of their datasets; a measure listed only for a
// dataset name shows the names that matched. Measures a structure leaves out are listed last.

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
 * `tree`: withMeasures(structure, …). `label(key)`, `size(key)` (datasets), `onCount(key)` (datasets on the
 * timeline), `names(key)` (dataset names, for the filter). `selected` and `onSelect(key)`: the measure chosen.
 * `structureId` and `onStructure(id)`: the structure shown.
 */
export default function StructureTree({ tree, label, size, onCount, names, selected, onSelect, structureId, onStructure }) {
  const [query, setQuery] = useState('');
  const [onlyData, setOnlyData] = useState(false);
  const [closed, setClosed] = useState(new Set());
  const ws = words(query);
  const searching = ws.length > 0;

  const total = node => node.measures.reduce((n, k) => n + size(k), 0) + node.children.reduce((n, c) => n + total(c), 0);
  const totalOn = node => node.measures.reduce((n, k) => n + onCount(k), 0) + node.children.reduce((n, c) => n + totalOn(c), 0);

  // A node as shown: its measures (with the dataset names that matched) and its children, or null when filtered out.
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
    return measures.length || children.length || hit ? { node, measures, children } : null;
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
  const branch = s => {
    const { node } = s;
    const n = total(node);
    const open = searching || !closed.has(node.id);
    const foldable = s.measures.length > 0 || s.children.length > 0;
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
          </ul>
        )}
      </li>
    );
  };

  return (
    <nav className="structure-tree" aria-label="Categories">
      <div className="st-controls">
        <span className="st-structures" role="group" aria-label="Structure">
          {STRUCTURES.map(s => (
            <button key={s.id} type="button" className={s.id === structureId ? 'on' : undefined} aria-pressed={s.id === structureId}
              onClick={() => { onStructure(s.id); setClosed(new Set()); }}>{s.id === 'comparative-agendas' ? 'Policy topics (CAP)' : s.name}</button>
          ))}
        </span>
        <input type="search" className="st-find" value={query} aria-label="Filter categories, measures and datasets"
          placeholder="Filter categories, measures and datasets…" onChange={e => setQuery(e.target.value)}
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
              <span className="category-name leaf"><span className="st-name">Not in this structure</span></span>
              <ul className="category-tree">{leftOut.map(leaf)}</ul>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}
