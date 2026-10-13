// A.1: one search field over a catalogue of every dataset, a tray of what is on (bundled by the chart
// each lands in), a year range, and the charts. The page is the same for A.1.1 and A.1.2; only the
// naming convention differs (window.GG_NAMING, labels in shared/labels.js).

const { h } = GG;
const label = GG.label;
const colors = GG.colorKeeper();
const TODAY = Date.UTC(2026, 9, 11);
const FREQS = [['D', 'Daily'], ['W', 'Weekly'], ['M', 'Monthly'], ['Q', 'Quarterly'], ['Y', 'Yearly'], ['FY', 'Fiscal year']];
const CONTEXT = [
  ['presidents', 'Presidents', 'pres'], ['recessions', 'Recessions', 'hatch'],
  ['fomc', 'Fed rate decisions', 'dot', 'var(--fed)'], ['tax-laws', 'Tax laws', 'dot', 'var(--legislative)'],
  ['relief', 'Relief laws', 'dot', 'var(--legislative)'], ['tariff-actions', 'Tariff orders', 'dot', 'var(--executive)'],
];

const state = {
  lines: [
    { slug: 'unemployment-rate', on: true }, { slug: 'unemployment-u6', on: true },
    { slug: 'fed-funds', on: true, band: ['fed-target-lower', 'fed-target-upper'] },
    { slug: 'gasoline-retail', on: true }, { slug: 'cpi', on: false },
  ],
  context: { presidents: true, recessions: true, fomc: false, 'tax-laws': false, relief: false, 'tariff-actions': false },
  rule: 'unit', years: [1993, 2026],
  catalogOpen: true, topic: 'all', freqs: new Set(), query: '',
};
const has = slug => state.lines.find(l => l.slug === slug);
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function toggle(slug, band) {
  const l = has(slug);
  if (l) { state.lines = state.lines.filter(x => x !== l); colors.free(slug); }
  else state.lines.push({ slug, on: true, band });
  drawCatalog(); drawChart();
}

// ── Page ─────────────────────────────────────────────────
const naming = window.GG_NAMING ?? 'phrase';
const base = location.pathname.split('/').pop().replace(/-\d\.html$/, '');
document.getElementById('app').innerHTML = `
  <div class="title-row">
    <h1>Timeline</h1>
    <span class="muted" style="font-size:13.5px">Find datasets below and tick them. Those measured alike share a chart; the rest stack on the same years.</span>
    <span class="naming-switch">Naming
      <a href="${base}-1.html" class="${naming === 'phrase' ? 'on' : ''}">Reads as a phrase</a>
      <a href="${base}-2.html" class="${naming === 'measure' ? 'on' : ''}">Measure: detail</a></span>
  </div>
  <label class="finder-field">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    <input id="q" autocomplete="off" placeholder="Search datasets: unemployment, taxes, gas prices, the Fed, tariffs…">
    <button class="browse on" id="browse" type="button"></button>
  </label>
  <section class="catalog" id="catalog">
    <div class="cat-filters" id="filters"></div>
    <div class="cat-body"><nav class="cat-nav" id="nav"></nav><div class="cat-list" id="list"></div></div>
  </section>
  <div class="tray" id="tray"></div>
  <div class="chart-opts">Share a chart when
    <span class="seg" id="rule"><button data-v="unit" class="on">measured alike</button><button data-v="subject">alike and same subject</button></span></div>
  <div id="years"></div>
  <div id="chart"></div>
  <p class="why-stack" id="why"></p>`;

// ── Catalogue ────────────────────────────────────────────
// Every row of the catalogue: a dataset under its topic and meaning. Search matches the name in
// both conventions, the topic's words (so "tax the rich" finds the tax topic) and the description.
const ROWS = GG_TOPICS.flatMap(t => t.intents.flatMap(i => i.series.map(s => ({ topic: t, intent: i, ...s }))));
const words = q => q.toLowerCase().split(/\s+/).filter(Boolean);
function matches(row, q) {
  if (!q) return true;
  const topicHit = [row.topic.label.toLowerCase(), ...row.topic.aliases].some(a => a.includes(q.toLowerCase()) || q.toLowerCase().includes(a));
  if (topicHit) return true;
  const s = GG.series(row.slug);
  const hay = `${GG_LABEL(row.slug, 'phrase')} ${GG_LABEL(row.slug, 'measure')} ${row.intent.label} ${row.why} ${s.description ?? ''} ${s.sourceName}`.toLowerCase();
  return words(q).every(w => hay.includes(w));
}
const visible = () => ROWS.filter(r => matches(r, state.query) && (!state.freqs.size || state.freqs.has(GG.series(r.slug).freq.code === '4W' ? 'W' : GG.series(r.slug).freq.code)));
function highlight(text) {
  if (!state.query) return esc(text);
  let out = esc(text);
  for (const w of words(state.query)) if (w.length > 1) out = out.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>');
  return out;
}

function drawCatalog() {
  document.getElementById('browse').textContent = state.catalogOpen ? 'Hide datasets' : `Browse all ${ROWS.length} datasets`;
  document.getElementById('browse').classList.toggle('on', state.catalogOpen);
  document.getElementById('catalog').hidden = !state.catalogOpen;
  if (!state.catalogOpen) return;
  const rows = visible();
  document.getElementById('filters').innerHTML = `
    <span class="f">How often ${FREQS.map(([c, n]) => `<button data-freq="${c}" class="${state.freqs.has(c) ? 'on' : ''}">${n}</button>`).join('')}</span>
    <span class="cat-count">${rows.length === ROWS.length ? `${ROWS.length} datasets` : `${rows.length} of ${ROWS.length} datasets`}${state.query ? ` match “${esc(state.query)}”` : ''}</span>`;
  const active = state.lines.filter(l => l.on);
  document.getElementById('nav').innerHTML = `<button data-topic="all" class="${state.topic === 'all' ? 'on' : ''}"><i>All subjects</i><span>${rows.length}</span></button>`
    + GG_TOPICS.map(t => {
      const n = rows.filter(r => r.topic === t).length, on = ROWS.filter(r => r.topic === t && has(r.slug)).length;
      return n ? `<button data-topic="${t.id}" class="${state.topic === t.id ? 'on' : ''}"><i>${t.label}</i>${on ? `<b>${on} on</b>` : ''}<span>${n}</span></button>` : '';
    }).join('');
  const topics = GG_TOPICS.filter(t => rows.some(r => r.topic === t));
  document.getElementById('list').innerHTML = topics.length ? topics.map(t => {
    const intents = t.intents.filter(i => rows.some(r => r.intent === i));
    return `<section class="cat-topic" id="topic-${t.id}"><h3>${t.label}</h3><p class="heard">In the news: ${t.heard}</p>
      ${intents.map(i => `<h4>${i.label}</h4>${rows.filter(r => r.intent === i).map(r => {
        const s = GG.series(r.slug), on = !!has(r.slug);
        const shares = GG.wouldShare(r.slug, active.filter(l => l.slug !== r.slug), state.rule);
        return `<button class="ds${on ? ' on' : ''}" data-slug="${r.slug}" ${r.band ? `data-band="${r.band.join(',')}"` : ''}>
          <span class="tick">${on ? '✓' : ''}</span>
          <span class="nm">${highlight(label(r.slug))}${r.slug === t.headline ? '<em>the one in the news</em>' : ''}</span>
          <span class="why">${highlight(r.why)}</span>
          <span class="meta">${GG.freqBadge(r.slug)} ${new Date(s.first).getUTCFullYear()}–${new Date(s.last).getUTCFullYear()} · ${s.sourceName}
            ${on ? '' : `<span class="lands${shares ? '' : ' new'}">· ${shares ? 'joins a chart' : 'new chart'}</span>`}</span>
        </button>`;
      }).join('')}`).join('')}
      ${!state.query && !state.freqs.size ? (t.missing ?? []).map(m => `<p class="cat-missing"><b>Not here yet.</b> ${m}</p>`).join('') : ''}
    </section>`;
  }).join('') : `<p class="cat-empty">No dataset matches “${esc(state.query)}”. Try a word from the news: jobs, prices, taxes, the Fed.</p>`;
}

const q = document.getElementById('q');
q.addEventListener('input', () => { state.query = q.value.trim(); state.catalogOpen = true; state.topic = 'all'; drawCatalog(); document.getElementById('list').scrollTop = 0; });
document.addEventListener('keydown', e => { if (e.key === '/' && document.activeElement !== q && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); q.focus(); } });
document.getElementById('browse').onclick = e => { e.preventDefault(); state.catalogOpen = !state.catalogOpen; drawCatalog(); };
document.getElementById('catalog').addEventListener('click', e => {
  const ds = e.target.closest('.ds'); if (ds) { toggle(ds.dataset.slug, ds.dataset.band?.split(',')); return; }
  const f = e.target.closest('[data-freq]'); if (f) { state.freqs.has(f.dataset.freq) ? state.freqs.delete(f.dataset.freq) : state.freqs.add(f.dataset.freq); drawCatalog(); return; }
  const t = e.target.closest('[data-topic]');
  if (t) {
    state.topic = t.dataset.topic; drawCatalog();
    const list = document.getElementById('list');
    list.scrollTop = t.dataset.topic === 'all' ? 0 : document.getElementById(`topic-${t.dataset.topic}`).offsetTop - list.offsetTop;
  }
});

// ── Tray, years, chart ───────────────────────────────────
const eye = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const eyeOff = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 4.4-1"/></svg>';

function drawChart() {
  const lines = state.lines.map(l => ({ ...l, color: colors.get(l.slug) }));
  const shown = lines.filter(l => l.on);
  const panels = GG.groupPanels(shown, state.rule);
  const all = GG.groupPanels(lines, state.rule);
  const tray = document.getElementById('tray');
  tray.innerHTML = '<span class="tray-label">On the timeline</span>';
  all.forEach(p => {
    const n = panels.findIndex(x => x.key === p.key);
    const b = h('div', 'bundle', `<span class="bundle-label">${n >= 0 ? `Chart ${n + 1} · ` : 'Hidden · '}${p.title}</span>`);
    for (const l of p.lines) {
      const s = GG.series(l.slug);
      const c = h('span', `chip${l.on ? '' : ' off'}`);
      c.style.setProperty('--c', l.color);
      c.title = `${label(l.slug)} · ${s.sourceName} · ${GG.FREQ[s.frequency].name}${s.shown ? `, shown as ${s.shown}` : ''}`;
      c.innerHTML = `<i class="sw"></i>${label(l.slug)} ${GG.freqBadge(l.slug)}
        <button data-eye="${l.slug}" aria-label="${l.on ? 'Hide' : 'Show'}">${l.on ? eye : eyeOff}</button>
        <button data-x="${l.slug}" aria-label="Remove">×</button>`;
      b.appendChild(c);
    }
    tray.appendChild(b);
  });
  tray.appendChild(h('div', 'ctx', '<span class="tray-label" style="padding:0 4px 0 6px">Context</span>'
    + CONTEXT.map(([k, name, sw, c]) => `<button class="chip${state.context[k] ? '' : ' off'}" data-ctx="${k}"><i class="sw ${sw}" style="${c ? `--c:${c}` : ''}"></i>${name}</button>`).join('')));

  const chart = document.getElementById('chart'), why = document.getElementById('why');
  if (!shown.length) { chart.innerHTML = '<div class="empty">Nothing on the chart. Tick a dataset above, or turn one back on in the tray.</div>'; why.textContent = ''; return; }
  const [a, b] = state.years;
  GG.render(chart, {
    panels, from: Date.UTC(a, 0, 1), to: Math.min(Date.UTC(b + 1, 0, 1), TODAY),
    context: { presidents: state.context.presidents, recessions: state.context.recessions },
    events: GG.eventsFor(['fomc', 'tax-laws', 'relief', 'tariff-actions'].filter(k => state.context[k])),
  });
  why.textContent = panels.length > 1 ? `${panels.length} charts: ${panels.map(p => p.title.toLowerCase()).join(', ')} are measured differently, so they are stacked on the same years rather than drawn against one scale.` : '';
}
document.getElementById('tray').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.eye) { const l = has(t.dataset.eye); l.on = !l.on; }
  if (t.dataset.x) { state.lines = state.lines.filter(l => l.slug !== t.dataset.x); colors.free(t.dataset.x); }
  if (t.dataset.ctx) state.context[t.dataset.ctx] = !state.context[t.dataset.ctx];
  drawCatalog(); drawChart();
});
document.getElementById('rule').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  state.rule = b.dataset.v;
  document.querySelectorAll('#rule button').forEach(x => x.classList.toggle('on', x === b));
  drawCatalog(); drawChart();
});
GG.yearRange(document.getElementById('years'), {
  min: 1980, max: 2026, start: state.years[0], end: state.years[1],
  presets: [['Since 1980', 1980, 2026], ['Since Clinton', 1993, 2026], ['Last 10 years', 2016, 2026], ['Since 2020', 2020, 2026]],
  onChange: (a, b) => { state.years = [a, b]; drawChart(); },
});

const preset = new URLSearchParams(location.search).get('q');
if (preset) { q.value = preset; state.query = preset; }
window.addEventListener('resize', drawChart);
drawCatalog(); drawChart();
