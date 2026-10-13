// Shared by the two Statistical Abstract navigation options: the page frame, the "on" counts, and the
// builder pane. The pane stands in for the app's Build mode (DatasetBuilder.jsx), which is unchanged: it shows
// where the measure sits in the Abstract, then its datasets as square buttons to put on and take off.
import { SECTIONS, ON } from './abstract.js';

export { SECTIONS };
export const on = { ...ON };
export const count = m => m.datasets.length;
export const measuresOf = section => section.subsections.flatMap(u => u.measures);
export const sectionCount = section => measuresOf(section).reduce((n, m) => n + count(m), 0);
export const sectionOn = section => measuresOf(section).reduce((n, m) => n + (on[m.key] ?? 0), 0);
export const subCount = sub => sub.measures.reduce((n, m) => n + count(m), 0);
export const find = key => {
  for (const s of SECTIONS) for (const u of s.subsections) for (const m of u.measures) if (m.key === key) return { section: s, sub: u, measure: m };
  return null;
};
export const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** The page around the catalogue: title, the option's note, the catalogue box with its tabs, then notes.
 * Search is inert in the mock; Structure shows the whole book; choosing a measure there opens it in Build. */
export function frame({ option, title, lede, notes, onMeasure }) {
  document.body.innerHTML = `
    <header class="topbar"><span class="brand">gov<b>graph</b></span>
      <nav class="nav"><span>Executive</span><span>Congress</span><span>Courts</span><span class="on">Timeline</span><span>Economy</span><span>Sources</span></nav>
      <span class="variant-tag">Build mode navigation · <a href="a-contents.html">Option A</a> · <a href="b-index.html">Option B</a> · <a href="../index.html">all variants</a></span></header>
    <main class="page">
      <h1>${option}: ${title}</h1>
      <p class="lede">${lede}</p>
      <div class="catalog">
        <div class="catalog-top"><span class="modes"><button disabled>Search</button><button data-mode="build">Build</button><button data-mode="structure">Structure</button></span><span class="muted">${SECTIONS.length} sections of the Statistical Abstract, 2012</span></div>
        <div class="catalog-body sa" id="body"></div>
        <div class="structure" id="structure" hidden></div>
      </div>
      <section class="notes">${notes}</section>
    </main>`;
  const body = document.getElementById('body');
  const struct = document.getElementById('structure');
  const setMode = mode => {
    body.hidden = mode !== 'build';
    struct.hidden = mode !== 'structure';
    if (mode === 'structure') struct.innerHTML = structure();
    for (const b of document.querySelectorAll('[data-mode]')) b.classList.toggle('on', b.dataset.mode === mode);
    try { history.replaceState(null, '', mode === 'structure' ? '?tab=structure' : location.pathname); } catch { /* file or sandbox */ }
  };
  document.querySelector('.modes').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); });
  struct.addEventListener('click', e => {
    const m = e.target.closest('[data-goto]');
    if (m) { setMode('build'); onMeasure?.(m.dataset.goto); }
  });
  setMode(new URLSearchParams(location.search).get('tab') === 'structure' ? 'structure' : 'build');
  return body;
}

/** The whole book at a glance: every section with its subsections nested under it, and the measures held in each. */
export function structure() {
  const subs = SECTIONS.reduce((n, s) => n + s.subsections.length, 0);
  const filledSubs = SECTIONS.reduce((n, s) => n + s.subsections.filter(u => subCount(u)).length, 0);
  const withData = SECTIONS.filter(s => sectionCount(s)).length;
  const tables = SECTIONS.at(-1).tables.split('–')[1];
  return `<div class="st-head">
      <h3>Statistical Abstract of the United States, 2012</h3>
      <p class="meta"><span>${SECTIONS.length} sections</span><span>${subs} subsections</span><span>Tables 1–${tables}</span><span><b>${withData}</b> sections and <b>${filledSubs}</b> subsections hold data</span></p>
      <p class="st-key"><span class="dot"></span> holds data &nbsp; <span class="dot bare"></span> not collected yet &nbsp; ◇ placed by GovGraph</p>
    </div>
    <div class="st-grid">${SECTIONS.map(s => {
      const c = sectionCount(s);
      return `<section class="st-sec${c ? '' : ' bare'}">
        <h4><span class="num">${s.n}</span><span class="t">${esc(s.title)}</span>${c ? `<span class="n">${c}</span>` : ''}</h4>
        <p class="st-tables">Tables ${s.tables}</p>
        ${s.subsections.length ? `<ul>${s.subsections.map(u => `<li class="${subCount(u) ? '' : 'bare'}"><span class="dot${subCount(u) ? '' : ' bare'}"></span>${esc(u.title)}
          ${u.measures.length ? `<ul>${u.measures.map(m => `<li><button data-goto="${m.key}">${esc(m.label)}${m.judgement ? ' <span class="mark">◇</span>' : ''}</button><span class="n">${count(m)}</span></li>`).join('')}</ul>` : ''}</li>`).join('')}</ul>`
          : '<p class="st-none">No subsections</p>'}
      </section>`;
    }).join('')}</div>`;
}

/** The builder for one measure, headed by where it sits in the book. `back` adds a link back to the section. */
export function pane(key, { back } = {}) {
  if (!key) return `<div class="builder"><p class="empty">Choose a section, then what to measure in it.</p></div>`;
  const { section, sub, measure } = find(key);
  const n = on[key] ?? 0;
  const shown = measure.datasets.slice(0, 18);
  return `<div class="builder">
    <p class="crumb">${back ? `<button class="back" data-back="${section.n}">← Sec. ${section.n}</button>` : `Sec. ${section.n} · ${esc(section.title)}`} <span>›</span> ${esc(sub.title)}</p>
    <div class="builder-head"><h3>${esc(measure.label)}</h3>${n ? `<button class="clear" data-clear="${key}">Take all off</button>` : ''}</div>
    ${measure.judgement ? `<p class="judgement"><b>◇ Placed by GovGraph.</b> ${esc(measure.judgement)}</p>` : ''}
    <p class="stand-in">The builder's options go here, as in the app (how it is measured, which part, how often). For the mock, its datasets:</p>
    <div class="ds">${shown.map((d, i) => `<button class="opt${i < n ? ' on' : ''}" data-ds="${key}" data-i="${i}">${esc(d)}</button>`).join('')}
      ${measure.datasets.length > shown.length ? `<span class="more">+ ${measure.datasets.length - shown.length} more</span>` : ''}</div>
  </div>`;
}

/** Ticking a dataset in the pane: the first n of a measure are "on". */
export function onPaneClick(e, rerender) {
  const ds = e.target.closest('[data-ds]');
  if (ds) {
    const key = ds.dataset.ds, i = +ds.dataset.i, n = on[key] ?? 0;
    on[key] = i < n ? i : i + 1;
    rerender();
    return true;
  }
  const clear = e.target.closest('[data-clear]');
  if (clear) { on[clear.dataset.clear] = 0; rerender(); return true; }
  return false;
}
