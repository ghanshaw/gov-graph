// Shared by the three Build variants: the catalogue frame (Browse and Build as separate tabs), the structure
// switch, the nested tree with its search and "only with data" filter, and the datasets of a subsection.
// The datasets pane stands in for the app's Build choices (DatasetBuilder.jsx), which stay as they are.
import { STRUCTURES, ON } from './data.js';

export const state = {
  sid: 'abstract',
  query: '',
  onlyData: false,
  selected: null,          // subsection id
  closed: new Set(),       // section ids folded in the tree
  more: new Set(),         // measures showing all their datasets
  on: { ...ON },
};
export const struct = () => STRUCTURES.find(s => s.id === state.sid);
export const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
export const subCount = u => u.measures.reduce((n, m) => n + m.datasets.length, 0);
export const subOn = u => u.measures.reduce((n, m) => n + (state.on[m.key] ?? 0), 0);
export const catCount = c => c.children.reduce((n, u) => n + subCount(u), 0);
export const catOn = c => c.children.reduce((n, u) => n + subOn(u), 0);
export const totalOn = () => Object.values(state.on).reduce((a, b) => a + b, 0);
export const findSub = id => { for (const c of struct().categories) for (const u of c.children) if (u.id === id) return { cat: c, sub: u }; return null; };
const codes = () => state.sid === 'cap';

// ---- search -------------------------------------------------------------------------------------------
const words = () => state.query.toLowerCase().split(/\s+/).filter(Boolean);
const has = (text, ws) => ws.every(w => text.toLowerCase().includes(w));
/** Highlights the search words in a piece of text. */
export function hi(text) {
  let out = esc(text);
  for (const w of words()) out = out.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>');
  return out;
}
/**
 * What the tree shows: each category with the subsections that pass the search and the filter, and for each
 * subsection the datasets or measures whose names matched (to say why a subsection is listed).
 */
export function visible() {
  const ws = words();
  return struct().categories.map(c => {
    const catHit = ws.length && has(`${c.code} ${c.name}`, ws);
    const children = c.children.map(u => {
      if (state.onlyData && !subCount(u)) return null;
      if (!ws.length || catHit) return { sub: u, hits: [] };
      const own = has(`${u.code ?? ''} ${u.name} ${u.description ?? ''} ${c.name}`, ws);
      const hits = u.measures.flatMap(m => [m.label, ...m.datasets].filter(t => has(t, ws)));
      return own || hits.length ? { sub: u, hits: own ? [] : [...new Set(hits)] } : null;
    }).filter(Boolean);
    return children.length || (catHit && !state.onlyData) ? { cat: c, children } : null;
  }).filter(Boolean);
}
export const subTotals = () => {
  const all = struct().categories.flatMap(c => c.children);
  return { subs: all.length, withData: all.filter(subCount).length, cats: struct().categories.length };
};

// ---- the pieces ---------------------------------------------------------------------------------------
export function structureSwitch() {
  return `<span class="seg" role="group" aria-label="Structure">${STRUCTURES.map(s =>
    `<button type="button" class="${s.id === state.sid ? 'on' : ''}" data-sid="${s.id}">${esc(s.name)}</button>`).join('')}</span>`;
}
export function searchBox(placeholder) {
  const level = struct().levels[1];
  return `<label class="find"><span aria-hidden="true">⌕</span><input type="search" data-q value="${esc(state.query)}" placeholder="${esc(placeholder ?? `Filter ${level}s and datasets…`)}"></label>`;
}
export function onlyDataBox() {
  const t = subTotals();
  return `<label class="only"><input type="checkbox" data-only ${state.onlyData ? 'checked' : ''}> Only with data <span class="n">${t.withData} of ${t.subs}</span></label>`;
}

/** The nested tree: categories with a fold, subsections on connector lines, counts and "on" at the right. */
export function tree({ rows = visible(), openOnly = null, hitLimit = 3 } = {}) {
  if (!rows.length) return `<p class="none">Nothing matches “${esc(state.query)}”.</p>`;
  const searching = words().length > 0;
  return `<div class="tree">${rows.map(({ cat, children }) => {
    const open = searching || (openOnly ? openOnly === cat.id : !state.closed.has(cat.id));
    const n = catCount(cat), o = catOn(cat);
    return `<div class="t-cat${n ? '' : ' bare'}">
      <button type="button" class="t-head" data-fold="${cat.id}" aria-expanded="${open}">
        <span class="caret">${open ? '▾' : '▸'}</span>${codes() ? `<span class="code">${cat.code}</span>` : ''}<span class="t-name">${hi(cat.name)}</span>
        <span class="end">${!open && o ? `<span class="badge">${o} on</span>` : ''}${n ? `<span class="n">${n}</span>` : ''}</span></button>
      ${open ? `<ul class="t-subs">${children.map(({ sub, hits }) => {
        const c = subCount(sub), so = subOn(sub);
        return `<li class="${c ? '' : 'bare'}${sub.id === state.selected ? ' sel' : ''}">
          <button type="button" data-sub="${esc(sub.id)}">${codes() && sub.code ? `<span class="code">${sub.code}</span>` : ''}<span class="t-name">${hi(sub.name)}</span>
            <span class="end">${so ? `<span class="badge">${so} on</span>` : ''}${c ? `<span class="n">${c}</span>` : ''}</span></button>
          ${hits.length ? `<div class="hits">${hits.slice(0, hitLimit).map(h => `<span>${hi(h)}</span>`).join('')}${hits.length > hitLimit ? `<span class="more">+ ${hits.length - hitLimit} more</span>` : ''}</div>` : ''}
        </li>`;
      }).join('')}</ul>` : ''}
    </div>`;
  }).join('')}</div>`;
}

/** Every dataset under one subsection, measure by measure. */
export function datasets({ back = false } = {}) {
  const found = state.selected && findSub(state.selected);
  if (!found) return `<div class="pane"><p class="none">Choose a ${struct().levels[1]} to see its datasets.</p></div>`;
  const { cat, sub } = found;
  const crumb = `${codes() ? `${cat.code} ` : `Sec. ${cat.code} · `}${esc(cat.name)}`;
  return `<div class="pane">
    <p class="crumb">${back ? `<button type="button" class="link" data-back>← All ${struct().levels[0]}s</button><span>·</span>` : ''}${crumb}</p>
    <h3>${codes() && sub.code ? `<span class="code">${sub.code}</span> ` : ''}${esc(sub.name)}</h3>
    ${sub.description ? `<p class="desc">${esc(sub.description)}</p>` : ''}
    ${!sub.measures.length ? `<p class="none">Nothing collected here yet.${state.sid === 'abstract' ? ' The Abstract’s tables for it are on the shopping list.' : ''}</p>` : `
    <p class="stand-in">${subCount(sub)} datasets in ${sub.measures.length} ${sub.measures.length === 1 ? 'measure' : 'measures'}. Choosing works as in the app; shown here as the datasets.</p>
    ${sub.measures.map(m => {
      const n = state.on[m.key] ?? 0, all = state.more.has(m.key), shown = all ? m.datasets : m.datasets.slice(0, 12);
      return `<section class="measure">
        <h4>${esc(m.label)} <span class="n">${m.datasets.length}</span>${n ? ` <span class="badge">${n} on</span>` : ''}</h4>
        ${m.judgement ? `<p class="judgement">◇ Placed by GovGraph. ${esc(m.judgement)}</p>` : ''}
        <div class="ds">${shown.map((d, i) => `<button type="button" class="opt${i < n ? ' on' : ''}" data-ds="${m.key}" data-i="${i}">${hi(d)}${i < n ? '<span class="x">×</span>' : ''}</button>`).join('')}
        ${m.datasets.length > 12 ? `<button type="button" class="link" data-more="${m.key}">${all ? 'Show fewer' : `Show all ${m.datasets.length}`}</button>` : ''}</div>
      </section>`;
    }).join('')}`}
  </div>`;
}

// ---- the page -----------------------------------------------------------------------------------------
const VARIANTS = [['wide-tree.html', 'D. Wide tree'], ['map-focus.html', 'E. Map, then focus'], ['filter-first.html', 'F. Filter first']];
/** The page and the catalogue with Browse and Build as tabs. `render` draws Build; it is called on every change. */
export function page({ variant, title, lede, notes, render, init }) {
  document.body.innerHTML = `
    <header class="topbar"><span class="brand">gov<b>graph</b></span>
      <nav class="nav"><span>Executive</span><span>Congress</span><span>Courts</span><span class="on">Timeline</span><span>Economy</span><span>Sources</span></nav>
      <span class="variant-tag">Build by structure · ${VARIANTS.map(([f, n]) => `<a href="${f}"${n.startsWith(variant) ? ' class="cur"' : ''}>${n.split('.')[0]}</a>`).join(' · ')} · <a href="../index.html">all variants</a></span></header>
    <main class="page">
      <h1>${variant}: ${title}</h1>
      <p class="lede">${lede}</p>
      <div class="catalog">
        <div class="catalog-top">
          <span class="modes"><button type="button" data-mode="browse">Browse</button><button type="button" data-mode="build">Build</button></span>
          <span class="inuse" id="inuse"></span>
        </div>
        <div id="browse" class="browse" hidden>
          <p><b>Browse</b> stays as it is in the app: the search field and the catalogue of every dataset by subject, with the “in the news” lines.
          It is kept apart from Build so that each does one thing: Browse finds a dataset by name; Build walks a structure down to its datasets.</p>
        </div>
        <div id="build"></div>
      </div>
      <section class="notes">${notes}</section>
    </main>`;
  const build = document.getElementById('build');
  const draw = () => {
    render(build);
    document.getElementById('inuse').innerHTML = `In use <b>${totalOn()}</b>`;
  };
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
    if (box) { box.focus(); box.setSelectionRange(at, at); }
  });
  build.addEventListener('change', e => { if (e.target.matches('[data-only]')) { state.onlyData = e.target.checked; draw(); } });
  build.addEventListener('keydown', e => { if (e.key === 'Escape' && e.target.matches('[data-q]')) { state.query = ''; draw(); } });
  build.addEventListener('click', e => {
    const t = e.target.closest('[data-sid],[data-fold],[data-sub],[data-ds],[data-more],[data-back],[data-act]');
    if (!t) return;
    const d = t.dataset;
    if (d.sid) { state.sid = d.sid; state.selected = null; state.closed.clear(); init?.reset?.(); }
    else if (d.fold) { state.closed.has(d.fold) ? state.closed.delete(d.fold) : state.closed.add(d.fold); }
    else if (d.sub) { state.selected = d.sub; init?.select?.(); }
    else if (d.ds) { const n = state.on[d.ds] ?? 0, i = +d.i; state.on[d.ds] = i < n ? i : i + 1; }
    else if (d.more) { state.more.has(d.more) ? state.more.delete(d.more) : state.more.add(d.more); }
    else if ('back' in d) { state.selected = null; state.closed.clear(); }
    else if (d.act === 'expand') state.closed.clear();
    else if (d.act === 'collapse') struct().categories.forEach(c => state.closed.add(c.id));
    else if (d.act) init?.act?.(d.act);
    draw();
  });
  const q = new URLSearchParams(location.search);
  if (q.get('structure') === 'cap') state.sid = 'cap';
  if (q.get('q')) state.query = q.get('q');
  if (q.get('only')) state.onlyData = true;
  if (q.get('sub')) state.selected = q.get('sub');
  init?.start?.(q);
  setMode(q.get('tab') === 'browse' ? 'browse' : 'build');
  draw();
}
