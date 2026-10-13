// AC.1: A.1.1 and C.1.1 together. The search and catalogue of every dataset across the top (A.1);
// below, the chart and the lane panel (C.1), where each lane is one chart and datasets are dragged
// between lanes. Names read as a phrase (shared/labels.js, NAMING.md).

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
// The lane a new dataset joins: one on its scale holding the same subject (the Black unemployment rate
// beside the unemployment rate, wherever that was dragged), else any on its scale, else a new lane.
function laneFor(slug) {
  const cat = GG.series(slug).category;
  const fits = state.lanes.filter(l => scales(l).includes(scaleOf(slug)));
  return fits.find(l => l.layers.some(x => GG.series(x.slug).category === cat)) ?? fits[0];
}
function add(slug, band) {
  if (allLayers().some(l => l.slug === slug)) return;
  const lane = laneFor(slug);
  if (lane) place(slug, lane, { band });
  else state.lanes.push({ id: ++laneSeq, layers: [{ slug, on: true, band }] });
  draw();
}
let toastTimer;
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3400); }

// ── Page ─────────────────────────────────────────────────
document.getElementById('app').innerHTML = `
  <div class="title-row">
    <h1>Timeline</h1>
    <span class="muted" style="font-size:13.5px">Search or browse the datasets, tick the ones you want. Each lane on the right is a chart; drag a dataset between lanes to draw it with others or on its own.</span>
  </div>
  <label class="finder-field">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    <input id="q" autocomplete="off" placeholder="Search datasets: unemployment, taxes, gas prices, the Fed, tariffs…">
    <span class="kbd">/</span>
    <button class="browse" id="browse" type="button"></button>
  </label>
  <section class="catalog" id="catalog" hidden>
    <div class="cat-filters" id="filters"></div>
    <div class="cat-body"><nav class="cat-nav" id="nav"></nav><div class="cat-list" id="list"></div></div>
  </section>
  <div class="layout">
    <div>
      <div id="years"></div>
      <div id="chart"></div>
      <div class="legend-freq">How often each is published:
        <span><abbr class="gg-freq f-D">D</abbr> daily</span><span><abbr class="gg-freq f-W">W</abbr> weekly</span><span><abbr class="gg-freq f-M">M</abbr> monthly</span>
        <span><abbr class="gg-freq f-Q">Q</abbr> quarterly</span><span><abbr class="gg-freq f-Y">Y</abbr> yearly</span><span><abbr class="gg-freq f-FY">FY</abbr> fiscal year</span>
        <span>· Quarterly and yearly values are drawn as a level across their period.</span>
      </div>
    </div>
    <aside class="layers" id="layers">
      <div class="sec" id="lanes"></div>
      <div class="sec" id="ctx"></div>
    </aside>
  </div>
  <div class="toast" id="toast"></div>`;

// ── Catalogue (A.1) ──────────────────────────────────────
// Every dataset under its subject and meaning. Search matches the name, the subject's words (so
// "tax the rich" finds the tax subject) and the description.
const FREQS = [['D', 'Daily'], ['W', 'Weekly'], ['M', 'Monthly'], ['Q', 'Quarterly'], ['Y', 'Yearly'], ['FY', 'Fiscal year']];
const cat = { open: false, topic: 'all', freqs: new Set(), query: '' };
const ROWS = GG_TOPICS.flatMap(t => t.intents.flatMap(i => i.series.map(s => ({ topic: t, intent: i, ...s }))));
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const words = q => q.toLowerCase().split(/\s+/).filter(Boolean);
const isOn = slug => allLayers().some(l => l.slug === slug);
function matches(row, q) {
  if (!q) return true;
  if ([row.topic.label.toLowerCase(), ...row.topic.aliases].some(a => a.includes(q.toLowerCase()) || q.toLowerCase().includes(a))) return true;
  const s = GG.series(row.slug);
  const hay = `${label(row.slug)} ${row.intent.label} ${row.why} ${s.description ?? ''} ${s.sourceName}`.toLowerCase();
  return words(q).every(w => hay.includes(w));
}
const freqCode = slug => { const c = GG.series(slug).freq.code; return c === '4W' ? 'W' : c; };
const visible = () => ROWS.filter(r => matches(r, cat.query) && (!cat.freqs.size || cat.freqs.has(freqCode(r.slug))));
function highlight(text) {
  let out = esc(text);
  for (const w of words(cat.query)) if (w.length > 1) out = out.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>');
  return out;
}
// Where a dataset would go if ticked: the lane already drawn in its scale, or a new one.
function landing(slug) {
  const i = state.lanes.indexOf(laneFor(slug));
  return i >= 0 ? { text: `→ lane ${i + 1}`, cls: '' } : { text: '→ new lane', cls: ' new' };
}
function drawCatalog() {
  const browse = document.getElementById('browse');
  browse.textContent = cat.open ? 'Done' : `Browse all ${ROWS.length} datasets`;
  browse.classList.toggle('on', cat.open);
  document.getElementById('catalog').hidden = !cat.open;
  if (!cat.open) return;
  const rows = visible();
  document.getElementById('filters').innerHTML = `
    <span class="f">How often ${FREQS.map(([c, n]) => `<button data-freq="${c}" class="${cat.freqs.has(c) ? 'on' : ''}">${n}</button>`).join('')}</span>
    <span class="cat-count">${rows.length === ROWS.length ? `${ROWS.length} datasets` : `${rows.length} of ${ROWS.length} datasets`}${cat.query ? ` match “${esc(cat.query)}”` : ''} · ${allLayers().length} on the timeline</span>`;
  document.getElementById('nav').innerHTML = `<button data-topic="all" class="${cat.topic === 'all' ? 'on' : ''}"><i>All subjects</i><span>${rows.length}</span></button>`
    + GG_TOPICS.map(t => {
      const n = rows.filter(r => r.topic === t).length, on = ROWS.filter(r => r.topic === t && isOn(r.slug)).length;
      return n ? `<button data-topic="${t.id}" class="${cat.topic === t.id ? 'on' : ''}"><i>${t.label}</i>${on ? `<b>${on} on</b>` : ''}<span>${n}</span></button>` : '';
    }).join('');
  const topics = GG_TOPICS.filter(t => rows.some(r => r.topic === t));
  document.getElementById('list').innerHTML = topics.length ? topics.map(t => `
    <section class="cat-topic" id="topic-${t.id}"><h3>${t.label}</h3><p class="heard">In the news: ${t.heard}</p>
      ${t.intents.filter(i => rows.some(r => r.intent === i)).map(i => `<h4>${i.label}</h4>${rows.filter(r => r.intent === i).map(r => {
        const s = GG.series(r.slug), on = isOn(r.slug), to = landing(r.slug);
        return `<button class="ds${on ? ' on' : ''}" data-slug="${r.slug}" ${r.band ? `data-band="${r.band.join(',')}"` : ''}>
          <span class="tick">${on ? '✓' : ''}</span>
          <span class="nm">${highlight(label(r.slug))}${r.slug === t.headline ? '<em>the one in the news</em>' : ''}</span>
          <span class="why">${highlight(r.why)}</span>
          <span class="meta">${GG.freqBadge(r.slug)} ${new Date(s.first).getUTCFullYear()}–${new Date(s.last).getUTCFullYear()} · ${s.sourceName}
            ${on ? '' : `<span class="lands${to.cls}">${to.text}</span>`}</span>
        </button>`;
      }).join('')}`).join('')}
      ${!cat.query && !cat.freqs.size ? (t.missing ?? []).map(m => `<p class="cat-missing"><b>Not here yet.</b> ${m}</p>`).join('') : ''}
    </section>`).join('') : `<p class="cat-empty">No dataset matches “${esc(cat.query)}”. Try a word from the news: jobs, prices, taxes, the Fed.</p>`;
}
const q = document.getElementById('q');
q.addEventListener('input', () => { cat.query = q.value.trim(); cat.open = true; cat.topic = 'all'; drawCatalog(); document.getElementById('list').scrollTop = 0; });
q.addEventListener('focus', () => { if (!cat.open) { cat.open = true; drawCatalog(); } });
document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); q.focus(); }
  if (e.key === 'Escape' && cat.open) { cat.open = false; drawCatalog(); q.blur(); }
});
document.getElementById('browse').onclick = e => { e.preventDefault(); cat.open = !cat.open; drawCatalog(); };
document.getElementById('catalog').addEventListener('click', e => {
  const ds = e.target.closest('.ds');
  if (ds) {
    const slug = ds.dataset.slug;
    if (isOn(slug)) { remove(slug); colors.free(slug); draw(); } else add(slug, ds.dataset.band?.split(','));
    return;
  }
  const f = e.target.closest('[data-freq]'); if (f) { cat.freqs.has(f.dataset.freq) ? cat.freqs.delete(f.dataset.freq) : cat.freqs.add(f.dataset.freq); drawCatalog(); return; }
  const t = e.target.closest('[data-topic]');
  if (t) {
    cat.topic = t.dataset.topic; drawCatalog();
    const list = document.getElementById('list');
    list.scrollTop = t.dataset.topic === 'all' ? 0 : document.getElementById(`topic-${t.dataset.topic}`).offsetTop - list.offsetTop;
  }
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
  const b = e.target.closest('button'); if (!b) return;
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
  drawLayers(); drawCatalog();
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
if (preset) { q.value = preset; cat.query = preset; cat.open = true; }
window.addEventListener('resize', draw);
draw();
