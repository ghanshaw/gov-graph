// D.1: the wide tree with a third level. Category → subcategory → measure, the measure being the leaf; choosing
// one opens the app's own Build choices for it (dimensions.js, copied from the client, on the real series).
// No codes; Browse and Build separate; Statistical Abstract or CAP's topics.
import { STRUCTURES } from './data.js';
import { VOCAB, SERIES } from './builder-data.js';
import { buildTree, withoutPath, yearsOf } from './dimensions.js';

const ONE = 'dataset';
const BY_MEASURE = new Map();
for (const s of SERIES) {
  const key = s.dimensions.measure;
  BY_MEASURE.set(key, [...(BY_MEASURE.get(key) ?? []), { ...s, dimensions: { ...s.dimensions, years: yearsOf(s) } }]);
}
const NAME = new Map(SERIES.map(s => [s.slug, s.name]));

const state = {
  sid: 'abstract',
  query: '',
  onlyData: false,
  measure: 'gdp',          // the leaf chosen
  closed: new Set(),       // category or subcategory ids folded
  picked: {},              // measure → Set of paths, as DatasetBuilder keeps them
};
const struct = () => STRUCTURES.find(s => s.id === state.sid);
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// ---- what is on: the datasets each measure's choices reach, as in DatasetBuilder ----------------------------
function treeOf(key) {
  return buildTree(VOCAB, key, BY_MEASURE.get(key) ?? [], state.picked[key] ?? new Set());
}
function targetOf(key) {
  if (!state.picked[key]?.size) return [];
  const t = treeOf(key);
  return t.automatic ? (state.picked[key].has(ONE) ? t.matches : []) : t.matches;
}
const onCount = key => targetOf(key).length;
const size = key => BY_MEASURE.get(key)?.length ?? 0;
const subCount = u => u.measures.reduce((n, m) => n + size(m.key), 0);
const subOn = u => u.measures.reduce((n, m) => n + onCount(m.key), 0);
const catCount = c => c.children.reduce((n, u) => n + subCount(u), 0);
const catOn = c => c.children.reduce((n, u) => n + subOn(u), 0);
const totalOn = () => [...BY_MEASURE.keys()].reduce((n, k) => n + onCount(k), 0);
const findMeasure = key => { for (const c of struct().categories) for (const u of c.children) for (const m of u.measures) if (m.key === key) return { cat: c, sub: u, m }; return null; };

// ---- search ------------------------------------------------------------------------------------------------
const words = () => state.query.toLowerCase().split(/\s+/).filter(Boolean);
const has = (text, ws) => ws.every(w => text.toLowerCase().includes(w));
function hi(text) {
  let out = esc(text);
  for (const w of words()) out = out.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>');
  return out;
}
/** Categories, subcategories and measures that pass the filter, with the dataset names that matched under a measure. */
function visible() {
  const ws = words();
  return struct().categories.map(c => {
    const catHit = ws.length && has(c.name, ws);
    const children = c.children.map(u => {
      if (state.onlyData && !subCount(u)) return null;
      const subHit = !ws.length || catHit || has(`${u.name} ${u.description ?? ''}`, ws);
      const measures = u.measures.map(m => {
        if (subHit || has(m.label, ws)) return { m, hits: [] };
        const hits = (BY_MEASURE.get(m.key) ?? []).map(s => s.name).filter(n => has(n, ws));
        return hits.length ? { m, hits } : null;
      }).filter(Boolean);
      return subHit || measures.length ? { sub: u, measures } : null;
    }).filter(Boolean);
    return children.length || (catHit && !state.onlyData) ? { cat: c, children } : null;
  }).filter(Boolean);
}

// ---- the category tree -------------------------------------------------------------------------------------
const end = (n, on, showOn = true) => `<span class="end">${showOn && on ? `<span class="badge">${on} on</span>` : ''}${n ? `<span class="n">${n}</span>` : ''}</span>`;
function categoryTree() {
  const rows = visible();
  if (!rows.length) return `<p class="none">Nothing matches “${esc(state.query)}”.</p>`;
  const searching = words().length > 0;
  return `<div class="ctree">${rows.map(({ cat, children }) => {
    const open = searching || !state.closed.has(cat.id);
    return `<div class="t-cat${catCount(cat) ? '' : ' bare'}">
      <button type="button" class="t-head" data-fold="${esc(cat.id)}" aria-expanded="${open}"><span class="caret">${open ? '▾' : '▸'}</span><span class="t-name">${hi(cat.name)}</span>${end(catCount(cat), catOn(cat), !open)}</button>
      ${open ? `<ul class="t-subs">${children.map(({ sub, measures }) => {
        const n = subCount(sub), subOpen = searching || !state.closed.has(sub.id);
        const foldable = sub.measures.length > 0;
        return `<li class="${n ? '' : 'bare'}">
          ${foldable ? `<button type="button" class="t-sub" data-fold="${esc(sub.id)}" aria-expanded="${subOpen}"><span class="caret">${subOpen ? '▾' : '▸'}</span><span class="t-name">${hi(sub.name)}</span>${end(n, subOn(sub), !subOpen)}</button>`
            : `<span class="t-sub empty"><span class="caret"></span><span class="t-name">${hi(sub.name)}</span></span>`}
          ${foldable && subOpen ? `<ul class="t-leaves">${measures.map(({ m, hits }) => `<li class="${m.key === state.measure ? 'sel' : ''}">
            <button type="button" data-m="${m.key}"><span class="t-name">${hi(m.label)}${m.judgement ? ' <span class="mark" title="Placed by GovGraph">◇</span>' : ''}</span>${end(size(m.key), onCount(m.key))}</button>
            ${hits.length ? `<div class="hits">${hits.slice(0, 3).map(h => `<span>${hi(h)}</span>`).join('')}${hits.length > 3 ? `<span class="more">+ ${hits.length - 3} more</span>` : ''}</div>` : ''}
          </li>`).join('')}</ul>` : ''}
        </li>`;
      }).join('')}</ul>` : ''}
    </div>`;
  }).join('')}</div>`;
}

// ---- the measure's Build choices: DatasetBuilder.jsx as HTML -------------------------------------------------
const choice = v => `<span class="pill choice${v.on ? ' on' : ''}"><button type="button" class="pick" aria-pressed="${v.on}" data-pick="${esc(v.path)}">${esc(v.label)}</button>${v.on ? `<button type="button" class="x" aria-label="Take out ${esc(v.label)}" title="Take out" data-unpick="${esc(v.path)}">×</button>` : ''}</span>`;
function line(values) {
  const groups = [];
  for (const v of values) {
    const key = v.kind ?? (v.depth >= 2 ? v.parent : '');
    let g = groups.find(x => x.key === key);
    if (!g) { g = { key, label: v.kind ?? values.find(o => o.value === v.parent)?.label, values: [] }; groups.push(g); }
    g.values.push(v);
  }
  return `<div class="tree-line">${groups.map((g, i) => `<div class="${i ? 'facet-line sub' : 'facet-line'}">${i > 0 && g.label ? `<span class="kinds">${esc(g.label)}:</span>` : ''}${g.values.map(choice).join('')}</div>`).join('')}</div>`;
}
function node(n) {
  return `${n.autos.length ? `<div class="tree-autos">${n.autos.map(a => `<span><span class="tree-label">${esc(a.label)}</span><span class="pill auto" title="The only one published here">${esc(a.value)}</span></span>`).join('')}</div>` : ''}
    ${n.level ? `<div class="tree-level"><p class="tree-label">${esc(n.level.label)}</p>${n.layout === 'line' ? line(n.values) : `<div class="tree-branches">${n.values.map(v => `
      <div class="tree-branch" style="margin-left:${v.depth * 16}px"><div class="tree-head">${choice(v)}${v.preview ? `<span class="tree-hint">${esc(v.preview)}</span>` : ''}</div>
      ${v.child && (v.child.level || v.child.autos.length) ? `<div class="tree-children">${node(v.child)}</div>` : ''}</div>`).join('')}</div>`}</div>` : ''}`;
}
function builderPane() {
  const found = state.measure && findMeasure(state.measure);
  if (!found) return `<div class="pane"><p class="none">Choose a measure in the tree.</p></div>`;
  const { cat, sub, m } = found;
  const key = m.key, picked = state.picked[key] ?? new Set();
  const tree = treeOf(key);
  const target = targetOf(key);
  return `<div class="pane app-builder"><div class="builder">
    <p class="crumb">${esc(cat.name)} <span>›</span> ${esc(sub.name)}</p>
    ${m.judgement ? `<p class="judgement">◇ Placed by GovGraph. ${esc(m.judgement)}</p>` : ''}
    <div class="builder-head"><h3>${esc(VOCAB.measures[key].label)}</h3>${picked.size ? '<button type="button" class="clear" data-clear>Clear choices</button>' : ''}</div>
    ${tree.automatic ? `<div class="one-dataset">${choice({ label: NAME.get(tree.matches[0]), path: ONE, on: picked.has(ONE) })}
        <span class="one-details" role="tooltip">${tree.after.map(a => `<span><span class="facet-label">${esc(a.label)}</span>${esc(a.values.join(', '))}</span>`).join('')}</span></div>`
      : `<div class="tree">${node(tree.root)}</div>
        <div class="tree-after">${tree.after.map(a => `<div class="facet"><span class="facet-label">${esc(a.label)}</span><div class="facet-line"><span class="fact">${esc(a.values.join(', '))}</span></div></div>`).join('')}</div>`}
    ${target.length ? `<div class="builder-status"><span class="label">On the timeline</span>${target.map(s => `<span class="chosen">${esc(NAME.get(s))}</span>`).join('')}</div>`
      : tree.waiting.length ? `<p class="builder-status">Choose ${esc(tree.waiting[0])} to put it on the timeline.</p>` : ''}
  </div></div>`;
}

// ---- controls and page ---------------------------------------------------------------------------------------
function controls() {
  const all = struct().categories.flatMap(c => c.children);
  const leaves = all.reduce((n, u) => n + u.measures.length, 0);
  return `<div class="d-controls">
    <span class="seg" role="group" aria-label="Structure">${STRUCTURES.map(s => `<button type="button" class="${s.id === state.sid ? 'on' : ''}" data-sid="${s.id}">${esc(s.name)}</button>`).join('')}</span>
    <label class="find"><span aria-hidden="true">⌕</span><input type="search" data-q value="${esc(state.query)}" placeholder="Filter categories, measures and datasets…"></label>
    <div class="row2"><label class="only"><input type="checkbox" data-only ${state.onlyData ? 'checked' : ''}> Only with data <span class="n">${all.filter(subCount).length} of ${all.length}</span></label>
      <span class="tools"><span class="n">${leaves} measures</span><button type="button" class="link" data-act="collapse" title="Fold all">−</button><button type="button" class="link" data-act="expand" title="Open all">+</button></span></div>
  </div>`;
}

const build = document.getElementById('build');
function draw() {
  const scroll = build.querySelector('.d-scroll')?.scrollTop ?? 0;
  build.innerHTML = `<div class="d-body"><div class="d-rail">${controls()}<div class="d-scroll">${categoryTree()}</div></div>${builderPane()}</div>`;
  build.querySelector('.d-scroll').scrollTop = scroll;
  document.getElementById('inuse').innerHTML = `In use <b>${totalOn()}</b>`;
}
const setMode = mode => {
  document.getElementById('browse').hidden = mode !== 'browse';
  build.hidden = mode !== 'build';
  for (const b of document.querySelectorAll('[data-mode]')) b.classList.toggle('on', b.dataset.mode === mode);
};
document.querySelector('.modes').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); });

build.addEventListener('input', e => {
  if (!e.target.matches('[data-q]')) return;
  state.query = e.target.value;
  const at = e.target.selectionStart;
  draw();
  const box = build.querySelector('[data-q]');
  box.focus(); box.setSelectionRange(at, at);
});
build.addEventListener('keydown', e => { if (e.key === 'Escape' && e.target.matches('[data-q]')) { state.query = ''; draw(); } });
build.addEventListener('change', e => { if (e.target.matches('[data-only]')) { state.onlyData = e.target.checked; draw(); } });
build.addEventListener('click', e => {
  const t = e.target.closest('[data-sid],[data-fold],[data-m],[data-pick],[data-unpick],[data-clear],[data-act]');
  if (!t) return;
  const d = t.dataset;
  const picks = () => (state.picked[state.measure] ??= new Set());
  if (d.sid) { state.sid = d.sid; state.closed.clear(); if (!findMeasure(state.measure)) state.measure = null; }
  else if (d.fold) state.closed.has(d.fold) ? state.closed.delete(d.fold) : state.closed.add(d.fold);
  else if (d.m) state.measure = d.m;
  else if (d.pick !== undefined) picks().add(d.pick);
  else if (d.unpick !== undefined) state.picked[state.measure] = withoutPath(picks(), d.unpick);
  else if ('clear' in d) state.picked[state.measure] = new Set();
  else if (d.act === 'expand') state.closed.clear();
  else if (d.act === 'collapse') struct().categories.forEach(c => state.closed.add(c.id));
  draw();
});

// Start as in the screenshots: the unemployment rate and the home price index on.
function seed(key, steps) {
  for (const value of steps) {
    const t = treeOf(key);
    const find = n => n.level && (n.values.find(v => v.value === value) ?? n.values.map(v => v.child && find(v.child)).find(Boolean));
    const v = find(t.root);
    if (!v || typeof v !== 'object' || !v.path) return;
    (state.picked[key] ??= new Set()).add(v.path);
  }
}
seed('unemployment', ['rate', 'u3', '|||']);
seed('home-prices', ['index']);

const q = new URLSearchParams(location.search);
if (q.get('structure') === 'cap') state.sid = 'cap';
if (q.get('q')) state.query = q.get('q');
if (q.get('only')) state.onlyData = true;
if (q.get('m')) state.measure = q.get('m');
setMode(q.get('tab') === 'browse' ? 'browse' : 'build');
draw();
