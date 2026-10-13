// C.1: the chart on the left, a layer panel on the right (search, context, lanes). Each lane is one
// chart; drag a layer between lanes. Same page for C.1.1 and C.1.2; only the naming differs.

const { h } = GG;
const label = GG.label;
const colors = GG.colorKeeper();
const TODAY = Date.UTC(2026, 9, 11);
const YEAR = 365.25 * 864e5;

// What can share a scale: the unit, with dollars only beside dollars over the same period. An index
// shares with nothing (each has its own base year).
const scaleOf = slug => { const s = GG.series(slug); return s.unit === 'index' ? `index|${slug}` : s.dollars ? `$|${s.frequency}` : s.unit; };
const scaleName = u => u.startsWith('$|') ? `Dollars, ${GG.FREQ[u.slice(2)].name.toLowerCase()}` : u.startsWith('index|') ? 'Index' : GG.panelTitle({ unit: u });

let laneSeq = 3;
const state = {
  years: [2000, 2026],
  context: { presidents: true, recessions: true, fomc: true, 'tax-laws': false, relief: false, 'tariff-actions': false },
  lanes: [
    { id: 1, layers: [{ slug: 'fed-funds', on: true, band: ['fed-target-lower', 'fed-target-upper'] }, { slug: 'unemployment-rate', on: true }, { slug: 'mortgage-rate', on: true }] },
    { id: 2, layers: [{ slug: 'cpi', on: true }, { slug: 'wti-spot', on: true, axis: 'right' }] },
    { id: 3, layers: [{ slug: 'mts-total-receipts', on: true }, { slug: 'mts-total-outlays', on: true }] },
  ],
};
const allLayers = () => state.lanes.flatMap(l => l.layers);
const scales = lane => [...new Set(lane.layers.map(l => scaleOf(l.slug)))];
const from = () => Date.UTC(state.years[0], 0, 1);
const to = () => Math.min(Date.UTC(state.years[1] + 1, 0, 1), TODAY);

// Where a layer may go: 'ok' (a scale the lane has), 'axis' (a second scale, on the right), 'no' (a third).
function verdict(lane, slug) {
  const u = scaleOf(slug), have = scales({ layers: lane.layers.filter(l => l.slug !== slug) });
  if (!have.length || have.includes(u)) return 'ok';
  return have.length === 1 ? 'axis' : 'no';
}
function place(slug, lane, extra = {}) {
  const v = verdict(lane, slug);
  if (v === 'no') { toast(`${label(slug)} is measured in ${scaleName(scaleOf(slug)).toLowerCase()}; this lane already has two scales.`); return false; }
  const same = lane.layers.find(l => scaleOf(l.slug) === scaleOf(slug));
  lane.layers.push({ slug, on: true, ...extra, axis: v === 'axis' ? 'right' : same?.axis });
  if (v === 'axis') toast(`${label(slug)} is drawn against a second scale, on the right.`);
  return true;
}
function remove(slug) {
  for (const lane of state.lanes) lane.layers = lane.layers.filter(l => l.slug !== slug);
  state.lanes = state.lanes.filter(l => l.layers.length);
}
function add(slug, band) {
  if (allLayers().some(l => l.slug === slug)) return;
  const lane = state.lanes.find(l => scales(l).includes(scaleOf(slug)));
  if (lane) place(slug, lane, { band });
  else state.lanes.push({ id: ++laneSeq, layers: [{ slug, on: true, band }] });
  draw();
}
let toastTimer;
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3400); }

// ── Page ─────────────────────────────────────────────────
const naming = window.GG_NAMING ?? 'phrase';
const base = location.pathname.split('/').pop().replace(/-\d\.html$/, '');
document.getElementById('app').innerHTML = `
  <div class="layout">
    <div>
      <div class="title-row">
        <h1>Timeline</h1>
        <span class="muted" style="font-size:13px">Each lane is a chart. Drag a dataset onto another lane to draw them together, or onto “New lane” to pull it apart.</span>
        <span class="naming-switch">Naming
          <a href="${base}-1.html" class="${naming === 'phrase' ? 'on' : ''}">Reads as a phrase</a>
          <a href="${base}-2.html" class="${naming === 'measure' ? 'on' : ''}">Measure: detail</a></span>
      </div>
      <div id="years"></div>
      <div id="chart"></div>
      <div class="legend-freq">How often each is published:
        <span><abbr class="gg-freq f-D">D</abbr> daily</span><span><abbr class="gg-freq f-W">W</abbr> weekly</span><span><abbr class="gg-freq f-M">M</abbr> monthly</span>
        <span><abbr class="gg-freq f-Q">Q</abbr> quarterly</span><span><abbr class="gg-freq f-Y">Y</abbr> yearly</span><span><abbr class="gg-freq f-FY">FY</abbr> fiscal year</span>
        <span>· Quarterly and yearly values are drawn as a level across their period.</span>
      </div>
    </div>
    <aside class="layers" id="layers">
      <div class="layers-search"><input id="q" placeholder="Add a dataset: search…" autocomplete="off"><div class="found" id="found"></div></div>
      <div class="sec" id="ctx"></div>
      <div class="sec" id="lanes"></div>
    </aside>
  </div>
  <div class="toast" id="toast"></div>`;

// ── Search ───────────────────────────────────────────────
const q = document.getElementById('q'), found = document.getElementById('found');
function search() {
  const text = q.value.trim();
  if (!text) {
    found.innerHTML = `<div class="hint">Type a subject, or start from one: ${GG_TOPICS.map(t => `<button data-fill="${t.label}">${t.label}</button>`).join(' · ')}</div>`;
    return;
  }
  const topic = GG.searchTopics(text)[0];
  const row = (slug, band) => {
    const s = GG.series(slug), on = allLayers().some(l => l.slug === slug);
    const lane = state.lanes.findIndex(l => scales(l).includes(scaleOf(slug)));
    return `<button class="res" data-add="${slug}" ${band ? `data-band="${band}"` : ''} ${on ? 'disabled' : ''}>
      <span class="plus">${on ? '✓' : '+'}</span><span>${label(slug)} ${GG.freqBadge(slug)}</span>
      <small>${on ? 'on' : lane >= 0 ? `→ lane ${lane + 1}` : '→ new lane'}</small></button>`;
  };
  const seen = new Set(topic ? topic.intents.flatMap(i => i.series.map(s => s.slug)) : []);
  const other = GG.searchSeries(text).filter(s => !seen.has(s.slug))
    .concat(Object.keys(GG_LABELS).filter(slug => !seen.has(slug) && GG.series(slug) && `${GG_LABEL(slug, 'phrase')} ${GG_LABEL(slug, 'measure')}`.toLowerCase().includes(text.toLowerCase())).map(GG.series))
    .filter((s, i, a) => a.findIndex(x => x.slug === s.slug) === i && !s.slug.startsWith('fed-target'));
  found.innerHTML = (topic ? topic.intents.map(i => `<h5>${topic.label} · ${i.label}</h5>${i.series.map(s => row(s.slug, s.band)).join('')}`).join('') : '')
    + (other.length ? `<h5>Other datasets named “${text}”</h5>${other.slice(0, 8).map(s => row(s.slug)).join('')}` : '')
    + (!topic && !other.length ? `<div class="hint">Nothing called “${text}”. Try jobs, prices, taxes, the Fed.</div>` : '');
}
q.addEventListener('input', search);
found.addEventListener('click', e => {
  const f = e.target.closest('[data-fill]'); if (f) { q.value = f.dataset.fill; search(); return; }
  const b = e.target.closest('[data-add]'); if (b) { add(b.dataset.add, b.dataset.band?.split(',')); search(); }
});

// ── Panel ────────────────────────────────────────────────
const CONTEXT = [
  ['presidents', 'Presidents', 'pres'], ['recessions', 'Recessions (NBER)', 'hatch'],
  ['fomc', 'Fed rate decisions', 'dot', 'var(--fed)'], ['tax-laws', 'Tax laws', 'dot', 'var(--legislative)'],
  ['relief', 'Relief laws', 'dot', 'var(--legislative)'], ['tariff-actions', 'Tariff orders', 'dot', 'var(--executive)'],
];
function countIn(k) {
  const inRange = d => { const t = GG.ms(d); return t >= from() && t < to(); };
  if (k === 'presidents') return GG_CONTEXT.presidents.filter((p, i, a) => GG.ms(p[2]) < to() && (i + 1 === a.length || GG.ms(a[i + 1][2]) > from())).length;
  if (k === 'recessions') return GG_CONTEXT.recessions.filter(([a, b]) => GG.ms(b) >= from() && GG.ms(a) < to()).length;
  return GG.eventsFor([k]).filter(e => inRange(e.date)).length;
}
// Only a dataset that does not cover the years shown says so.
function spanNote(slug) {
  const s = GG.series(slug), a = s.first > from() + YEAR / 2, b = s.last < to() - YEAR;
  const y = t => new Date(t).getUTCFullYear();
  return a && b ? `only ${y(s.first)}–${y(s.last)}` : a ? `starts ${y(s.first)}` : b ? `ends ${y(s.last)}` : '';
}
function drawLayers() {
  document.getElementById('ctx').innerHTML = '<h4><span>Context</span><span style="text-transform:none;letter-spacing:0;font-weight:400">in the years shown</span></h4>'
    + CONTEXT.map(([k, name, sw, c]) => `<label class="ctxrow"><input type="checkbox" data-ctx="${k}" ${state.context[k] ? 'checked' : ''}><i class="sw ${sw}" style="${c ? `--c:${c}` : ''}"></i>${name}<small>${countIn(k)}</small></label>`).join('');
  const lanes = document.getElementById('lanes');
  lanes.innerHTML = '<h4><span>Lanes, top to bottom</span></h4>';
  state.lanes.forEach((lane, i) => {
    const el = h('div', 'lane'); el.dataset.lane = lane.id;
    const sc = scales(lane);
    const sideOf = u => lane.layers.find(l => scaleOf(l.slug) === u)?.axis === 'right' ? 'right' : 'left';
    el.innerHTML = `<div class="lane-head"><b>Lane ${i + 1}</b>
        <span class="scales">${sc.length > 1 ? sc.map(u => `${scaleName(u)} (${sideOf(u)})`).join(' · ') : scaleName(sc[0])}</span>
        <span class="move"><button data-up="${lane.id}" ${i ? '' : 'disabled'} title="Move up">↑</button><button data-down="${lane.id}" ${i < state.lanes.length - 1 ? '' : 'disabled'} title="Move down">↓</button></span></div>
      <div class="lane-drop-note"></div>`
      + lane.layers.map(l => {
        const s = GG.series(l.slug), note = spanNote(l.slug);
        return `<div class="layer${l.on ? '' : ' off'}" draggable="true" data-slug="${l.slug}" style="--c:${colors.get(l.slug)}" title="${s.sourceName} · ${GG.FREQ[s.frequency].name}${s.shown ? `, shown as ${s.shown}` : ''}">
          <span class="grip">⋮⋮</span><button class="eye" data-eye="${l.slug}" title="${l.on ? 'Hide' : 'Show'}">${l.on ? '◉' : '○'}</button><span class="sw"></span>
          <span class="nm">${label(l.slug)}${note ? `<span class="span">${note}</span>` : ''}</span>
          <span class="tail">${GG.freqBadge(l.slug)}${sc.length > 1 ? `<button class="axis" data-axis="${lane.id}" title="Swap the two scales">${l.axis === 'right' ? 'R' : 'L'}</button>` : ''}<button class="x" data-x="${l.slug}" title="Remove">×</button></span></div>`;
      }).join('');
    lanes.appendChild(el);
  });
  const nl = h('div', 'newlane', '+ New lane: drop a dataset here'); nl.dataset.lane = 'new';
  lanes.appendChild(nl);
}

let dragging = null;
const panel = document.getElementById('layers');
panel.addEventListener('dragstart', e => { const l = e.target.closest('.layer'); if (l) { dragging = l.dataset.slug; e.dataTransfer.effectAllowed = 'move'; } });
panel.addEventListener('dragend', () => { dragging = null; document.querySelectorAll('.lane,.newlane').forEach(x => x.classList.remove('drop-ok', 'drop-axis', 'drop-no')); });
panel.addEventListener('dragover', e => {
  const t = e.target.closest('[data-lane]'); if (!t || !dragging) return;
  e.preventDefault();
  document.querySelectorAll('.lane,.newlane').forEach(x => x !== t && x.classList.remove('drop-ok', 'drop-axis', 'drop-no'));
  if (t.dataset.lane === 'new') { t.classList.add('drop-ok'); return; }
  const lane = state.lanes.find(l => String(l.id) === t.dataset.lane);
  const v = verdict(lane, dragging);
  t.classList.remove('drop-ok', 'drop-axis', 'drop-no'); t.classList.add(`drop-${v}`);
  t.querySelector('.lane-drop-note').textContent = v === 'axis' ? `Adds a second scale on the right (${scaleName(scaleOf(dragging)).toLowerCase()})` : v === 'no' ? 'This lane already has two scales' : '';
});
panel.addEventListener('drop', e => {
  const t = e.target.closest('[data-lane]'); if (!t || !dragging) return;
  e.preventDefault();
  const layer = allLayers().find(l => l.slug === dragging);
  if (t.dataset.lane === 'new') { remove(dragging); state.lanes.push({ id: ++laneSeq, layers: [{ ...layer, axis: undefined }] }); }
  else {
    const lane = state.lanes.find(l => String(l.id) === t.dataset.lane);
    if (!lane.layers.includes(layer)) {
      if (verdict(lane, dragging) !== 'no') { remove(dragging); place(dragging, lane, { band: layer.band, on: layer.on }); }
      else place(dragging, lane);
    }
  }
  draw();
});
panel.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.closest('.found')) return;
  const laneOf = id => state.lanes.findIndex(l => String(l.id) === id);
  if (b.dataset.eye) { const l = allLayers().find(x => x.slug === b.dataset.eye); l.on = !l.on; }
  else if (b.dataset.x) { remove(b.dataset.x); colors.free(b.dataset.x); }
  else if (b.dataset.axis) state.lanes[laneOf(b.dataset.axis)].layers.forEach(l => { l.axis = l.axis === 'right' ? 'left' : 'right'; });
  else if (b.dataset.up || b.dataset.down) {
    const i = laneOf(b.dataset.up ?? b.dataset.down), j = b.dataset.up ? i - 1 : i + 1;
    [state.lanes[i], state.lanes[j]] = [state.lanes[j], state.lanes[i]];
  } else return;
  draw();
});
panel.addEventListener('change', e => { const k = e.target.dataset.ctx; if (k) { state.context[k] = e.target.checked; draw(); } });

function draw() {
  drawLayers();
  const panels = state.lanes.map((lane, i) => {
    const sc = scales(lane);
    const sideOf = u => lane.layers.find(l => scaleOf(l.slug) === u)?.axis === 'right' ? 'right' : 'left';
    return {
      key: lane.id, title: `Lane ${i + 1} · ${sc.length > 1 ? sc.map(u => `${scaleName(u)} (${sideOf(u)})`).join(', ') : scaleName(sc[0])}`,
      lines: lane.layers.filter(l => l.on).map(l => ({ ...l, color: colors.get(l.slug) })),
    };
  }).filter(p => p.lines.length);
  GG.render(document.getElementById('chart'), {
    panels, from: from(), to: to(), panelHeight: 150,
    context: { presidents: state.context.presidents, recessions: state.context.recessions },
    events: GG.eventsFor(['fomc', 'tax-laws', 'relief', 'tariff-actions'].filter(k => state.context[k])),
  });
}
GG.yearRange(document.getElementById('years'), {
  min: 1980, max: 2026, start: state.years[0], end: state.years[1],
  presets: [['Since 1980', 1980, 2026], ['Since Clinton', 1993, 2026], ['Since 2000', 2000, 2026], ['Last 10 years', 2016, 2026]],
  onChange: (a, b) => { state.years = [a, b]; draw(); },
});
const preset = new URLSearchParams(location.search).get('q');
if (preset) q.value = preset;
window.addEventListener('resize', draw);
search(); draw();
