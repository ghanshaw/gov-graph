// A small chart engine for the timeline-data mocks: stacked panels on one date axis, a shared
// cursor, presidencies and recessions behind every panel, and events in a lane. Not the app's
// code (HorizontalTimeline.jsx); just enough to judge the designs with real data.
//
//   GG.series(slug)                 → { ...meta, obs: [{ t, v }] } (values in dollars for dollar units)
//   GG.groupPanels(lines, rule)     → panels: lines that can share a chart share one
//   GG.render(el, { panels, from, to, events, context, onCursor })
//
// How each frequency is drawn: daily, weekly and monthly values as a line through each period's
// middle; quarterly, yearly and fiscal-year values as a level across the period they stand for (a
// step), so a yearly number never looks like a point-in-time reading; irregular values (the FOMC
// target) as steps from each date on.

(function () {
  const RAW = window.GG_SERIES;
  const DAY = 864e5;
  const DOLLAR = { $: 1, $k: 1e3, $m: 1e6, $bn: 1e9 };
  const COARSE = new Set(['quarterly', 'annual', 'fiscal-year', 'irregular']);
  const FREQ = {
    daily: { code: 'D', name: 'Daily' }, weekly: { code: 'W', name: 'Weekly' }, 'four-week-average': { code: '4W', name: '4-week average' },
    monthly: { code: 'M', name: 'Monthly' }, quarterly: { code: 'Q', name: 'Quarterly' }, annual: { code: 'Y', name: 'Yearly' },
    'fiscal-year': { code: 'FY', name: 'Fiscal year' }, irregular: { code: '·', name: 'When changed' },
  };
  const UNIT_NAMES = { '%': 'Percent', index: 'Index', thousands: 'People', '$/bbl': 'Dollars a barrel', '$/gal': 'Dollars a gallon', 'kb/d': 'Barrels a day' };
  const SOURCES = {
    bls: 'BLS', 'bls-bulk': 'BLS', bea: 'BEA', treasury: 'Treasury', 'treasury-mts': 'Treasury MTS', 'treasury-dts': 'Treasury DTS', 'treasury-mts-4': 'Treasury MTS', 'treasury-mts-1': 'Treasury MTS',
    eia: 'EIA', 'fed-h15': 'Federal Reserve', 'fed-omo': 'Federal Reserve', freddiemac: 'Freddie Mac', omb: 'OMB', cbo: 'CBO',
    'irs-soi': 'IRS', usitc: 'USITC', census: 'Census', 'census-api': 'Census', 'census-trade': 'Census', umich: 'U. Michigan',
    fhfa: 'FHFA', atlantafed: 'Atlanta Fed',
  };
  const ms = iso => Date.parse(iso + 'T00:00:00Z');
  const cache = new Map();
  const label = slug => (window.GG_LABEL ? window.GG_LABEL(slug) : RAW[slug]?.name ?? slug);

  function series(slug) {
    if (cache.has(slug)) return cache.get(slug);
    const r = RAW[slug];
    if (!r) return null;
    const scale = DOLLAR[r.unit] ?? 1;
    const dates = r.d.split(',');
    const s = {
      slug, ...r, dollars: r.unit in DOLLAR, freq: FREQ[r.frequency], sourceName: SOURCES[r.source] ?? r.source,
      obs: dates.map((d, i) => ({ t: ms(d), v: r.v[i] * scale })),
    };
    s.first = s.obs[0]?.t; s.last = s.obs.at(-1)?.t;
    cache.set(slug, s);
    return s;
  }

  // The end of the period an observation stands for.
  function periodEnd(t, frequency, next) {
    const d = new Date(t);
    const add = (m) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m, d.getUTCDate());
    switch (frequency) {
      case 'daily': return t + DAY;
      case 'weekly': case 'four-week-average': return t + 7 * DAY;
      case 'monthly': return add(1);
      case 'quarterly': return add(3);
      case 'annual': case 'fiscal-year': return add(12);
      default: return next ?? t + 30 * DAY;
    }
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const shortDate = t => { const d = new Date(t); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };
  function periodLabel(t, frequency, shown) {
    const d = new Date(t), y = d.getUTCFullYear();
    if (shown === 'weekly averages') return `week of ${shortDate(t)}`;
    switch (frequency) {
      case 'monthly': return `${MONTHS[d.getUTCMonth()]} ${y}`;
      case 'quarterly': return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${y}`;
      case 'annual': return String(y);
      case 'fiscal-year': return `FY ${y + 1}`;
      case 'weekly': return `week of ${shortDate(t)}`;
      case 'four-week-average': return `4 weeks to ${shortDate(t)}`;
      case 'irregular': return `from ${shortDate(t)}`;
      default: return shortDate(t);
    }
  }

  function inWords(n) {
    const a = Math.abs(n), s = n < 0 ? '−' : '';
    if (a >= 1e12) return `${s}$${(a / 1e12).toFixed(2)} trillion`;
    if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(1)} billion`;
    if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)} million`;
    return `${s}$${Math.round(a).toLocaleString()}`;
  }
  function formatValue(v, unit) {
    if (v == null) return '—';
    if (unit in DOLLAR) return inWords(v);
    if (unit === '%') return `${v.toFixed(1)}%`;
    if (unit === '$/bbl' || unit === '$/gal') return `$${v.toFixed(2)}`;
    if (unit === 'thousands') return v >= 1000 ? `${(v / 1000).toFixed(2)} million` : `${Math.round(v)},000`;
    if (unit === 'index') return v.toFixed(1);
    return v.toLocaleString();
  }
  function formatTick(v, unit) {
    if (unit in DOLLAR) {
      const a = Math.abs(v), [d, x] = a >= 1e12 ? [1e12, 'T'] : a >= 1e9 ? [1e9, 'B'] : a >= 1e6 ? [1e6, 'M'] : a >= 1e3 ? [1e3, 'k'] : [1, ''];
      return `${v < 0 ? '−' : ''}$${+(a / d).toFixed(1)}${x}`;
    }
    if (unit === '%') return `${+v.toFixed(2)}%`;
    if (unit === '$/bbl' || unit === '$/gal') return `$${+v.toFixed(2)}`;
    if (unit === 'thousands') return v >= 1000 ? `${+(v / 1000).toFixed(1)}M` : `${v}k`;
    return String(+v.toFixed(2));
  }
  const unitFamily = u => (u in DOLLAR ? '$' : u);

  // Which lines share a chart. 'unit': measured alike (percent with percent; dollars with dollars
  // over the same period, since a month's receipts and a year's are not comparable on one axis).
  // 'subject': also the same subject, so the jobless rate and the Fed's rate are kept apart.
  // An index never shares: each has its own base year.
  function panelKey(s, rule) {
    let key = s.dollars ? `$|${s.frequency === 'quarterly' && /annual rate/i.test(s.description ?? '') ? 'annual' : s.frequency}` : s.unit;
    if (s.unit === 'index') key = `index|${s.slug}`;
    if (rule === 'subject') key += `|${s.category}`;
    return key;
  }
  function panelTitle(s) {
    if (s.dollars) return `Dollars, ${FREQ[s.frequency].name.toLowerCase()}`;
    if (s.unit === 'index') return `Index · ${s.name}`;
    return UNIT_NAMES[s.unit] ?? s.unit;
  }
  function groupPanels(lines, rule = 'unit') {
    const panels = new Map();
    for (const line of lines) {
      const s = series(line.slug);
      const key = panelKey(s, rule);
      if (!panels.has(key)) panels.set(key, { key, title: panelTitle(s), lines: [] });
      panels.get(key).lines.push(line);
    }
    return [...panels.values()];
  }
  // Why a series would get its own chart beside these: for the "will stack" hints.
  function wouldShare(slug, lines, rule = 'unit') {
    const k = panelKey(series(slug), rule);
    return lines.some(l => panelKey(series(l.slug), rule) === k);
  }

  function niceTicks(lo, hi, n = 4) {
    if (lo === hi) { lo -= 1; hi += 1; }
    const step0 = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(step0));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0);
    const start = Math.floor(lo / step) * step, ticks = [];
    for (let v = start; v <= hi + step * 0.001; v += step) ticks.push(+v.toPrecision(12));
    if (ticks.at(-1) < hi) ticks.push(ticks.at(-1) + step);
    return ticks;
  }

  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  };
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  // The observation in effect at t: the one whose period contains it, or null.
  function valueAt(s, t) {
    const o = s.obs; let lo = 0, hi = o.length - 1, i = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (o[m].t <= t) { i = m; lo = m + 1; } else hi = m - 1; }
    if (i < 0) return null;
    const end = periodEnd(o[i].t, s.frequency, o[i + 1]?.t);
    const slack = s.frequency === 'irregular' ? Infinity : COARSE.has(s.frequency) ? 0 : (end - o[i].t) * 0.5;
    if (t > end + slack) return { ...o[i], stale: true, i };
    return { ...o[i], i };
  }

  /**
   * panels: [{ key, title, lines: [{ slug, color, label?, axis?: 'right', band?: [lowerSlug, upperSlug] }], note? }]
   * Returns { setRange(from, to) }.
   */
  function render(root, opts) {
    const { panels, context = {}, events = [], panelHeight = 150 } = opts;
    let from = opts.from, to = opts.to;
    root.innerHTML = '';
    root.classList.add('gg-chart');
    const M = { l: 58, r: 58, t: 8, b: 8 };
    const width = Math.max(320, root.clientWidth);
    const W = width - M.l - M.r;
    const x = t => M.l + ((t - from) / (to - from)) * W;
    const tAt = px => from + ((px - M.l) / W) * (to - from);
    const cursors = [];

    // Presidencies strip.
    if (context.presidents !== false) {
      const strip = el('svg', { width, height: 22, class: 'gg-pres' }, root);
      const P = window.GG_CONTEXT.presidents;
      P.forEach(([name, party, start], i) => {
        const a = Math.max(ms(start), from), b = Math.min(i + 1 < P.length ? ms(P[i + 1][2]) : to, to);
        if (b <= a) return;
        el('rect', { x: x(a), y: 4, width: Math.max(0, x(b) - x(a) - 1), height: 14, class: `gg-pres-${party}` }, strip);
        if (x(b) - x(a) > 46) { const tx = el('text', { x: x(a) + 5, y: 15 }, strip); tx.textContent = name; }
      });
      const pl = el('text', { x: M.l - 6, y: 15, 'text-anchor': 'end', class: 'gg-axis-label' }, strip); pl.textContent = 'President';
      cursors.push({ svg: strip, height: 22, lines: [] });
    }

    // Recessions: a labelled bar each, in their own row, and a hatch through every panel below.
    if (context.recessions !== false) {
      const row = el('svg', { width, height: 20, class: 'gg-periods' }, root);
      const rl = el('text', { x: M.l - 6, y: 14, 'text-anchor': 'end', class: 'gg-axis-label' }, row); rl.textContent = 'Recession';
      for (const [a, b] of window.GG_CONTEXT.recessions) {
        const xa = Math.max(x(ms(a)), M.l), xb = Math.min(x(ms(b)), M.l + W);
        if (xb <= xa) continue;
        const g = el('g', { class: 'gg-period' }, row);
        el('rect', { x: xa, y: 4, width: Math.max(2, xb - xa), height: 12 }, g);
        const y0 = new Date(ms(a)).getUTCFullYear(), y1 = new Date(ms(b)).getUTCFullYear();
        if (xb - xa > 34) { const tx = el('text', { x: xa + 4, y: 13.5 }, g); tx.textContent = y0 === y1 ? y0 : `${y0}–${String(y1).slice(2)}`; }
        const title = el('title', {}, g); title.textContent = `Recession, ${shortDate(ms(a))} – ${shortDate(ms(b))} (NBER)`;
      }
      cursors.push({ svg: row, height: 20, lines: [] });
    }

    // Events lane.
    if (events.length) {
      const lane = el('svg', { width, height: 26, class: 'gg-events' }, root);
      el('line', { x1: M.l, x2: M.l + W, y1: 13, y2: 13, class: 'gg-events-axis' }, lane);
      const lbl = el('text', { x: M.l - 6, y: 17, 'text-anchor': 'end', class: 'gg-axis-label' }, lane); lbl.textContent = 'Events';
      for (const e of events) {
        const t = ms(e.date); if (t < from || t > to) continue;
        const g = el('g', { class: `gg-event gg-event-${e.set}` }, lane);
        el('circle', { cx: x(t), cy: 13, r: 4.5 }, g);
        const title = el('title', {}, g); title.textContent = `${shortDate(t)} · ${e.label} (${e.ref})`;
      }
      cursors.push({ svg: lane, height: 26, lines: [] });
    }

    const defs = el('svg', { width: 0, height: 0, style: 'position:absolute' }, root);
    const pat = el('pattern', { id: 'gg-hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, el('defs', {}, defs));
    el('rect', { width: 6, height: 6, class: 'gg-hatch-bg' }, pat);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 6, class: 'gg-hatch-line' }, pat);
    const readout = h('div', 'gg-readout');
    const panelEls = [];
    panels.forEach((panel, pi) => {
      const wrap = h('div', 'gg-panel');
      wrap.dataset.key = panel.key;
      const head = h('div', 'gg-panel-head');
      head.appendChild(h('span', 'gg-panel-title', panel.title));
      const legend = h('span', 'gg-legend');
      for (const line of panel.lines) {
        const s = series(line.slug);
        legend.appendChild(h('span', 'gg-legend-item', `<i style="background:${line.color}"></i>${line.label ?? label(line.slug)}${line.axis === 'right' ? ' <small>right axis</small>' : ''}`));
      }
      head.appendChild(legend);
      if (panel.note) head.appendChild(h('span', 'gg-panel-note', panel.note));
      wrap.appendChild(head);
      opts.decoratePanel?.(panel, head, pi);
      const svg = el('svg', { width, height: panelHeight + M.t + M.b }, wrap);
      root.appendChild(wrap);
      panelEls.push({ panel, svg, wrap });

      // Recessions behind.
      if (context.recessions !== false) for (const [a, b] of window.GG_CONTEXT.recessions) {
        const xa = Math.max(x(ms(a)), M.l), xb = Math.min(x(ms(b)), M.l + W);
        if (xb > xa) el('rect', { x: xa, y: M.t, width: xb - xa, height: panelHeight, class: 'gg-recession', fill: 'url(#gg-hatch)' }, svg);
      }

      // Scales per axis.
      const axes = {};
      for (const line of panel.lines) {
        const s = series(line.slug), side = line.axis === 'right' ? 'right' : 'left';
        const ax = axes[side] ??= { lo: Infinity, hi: -Infinity, unit: s.dollars ? '$' : s.unit };
        const vis = [...s.obs.filter(o => o.t >= from - 400 * DAY && o.t <= to)];
        if (line.band) for (const b of line.band) vis.push(...series(b).obs.filter(o => o.t >= from - 400 * DAY && o.t <= to));
        for (const o of vis) { ax.lo = Math.min(ax.lo, o.v); ax.hi = Math.max(ax.hi, o.v); }
      }
      for (const [side, ax] of Object.entries(axes)) {
        if (!isFinite(ax.lo)) { ax.lo = 0; ax.hi = 1; }
        const includeZero = ax.lo > 0 && ax.lo < (ax.hi - ax.lo) * 0.6;
        ax.ticks = niceTicks(includeZero ? 0 : ax.lo, ax.hi);
        const [a, b] = [ax.ticks[0], ax.ticks.at(-1)];
        ax.y = v => M.t + panelHeight - ((v - a) / (b - a)) * panelHeight;
        for (const tv of ax.ticks) {
          if (side === 'left') el('line', { x1: M.l, x2: M.l + W, y1: ax.y(tv), y2: ax.y(tv), class: tv === 0 ? 'gg-zero' : 'gg-grid' }, svg);
          const tx = el('text', { x: side === 'left' ? M.l - 6 : M.l + W + 6, y: ax.y(tv) + 4, 'text-anchor': side === 'left' ? 'end' : 'start', class: 'gg-tick' }, svg);
          tx.textContent = formatTick(tv, ax.unit);
        }
      }

      const clip = `clip-${Math.random().toString(36).slice(2)}`;
      el('rect', { x: M.l, y: 0, width: W, height: panelHeight + M.t + M.b }, el('clipPath', { id: clip }, el('defs', {}, svg)));
      const plot = el('g', { 'clip-path': `url(#${clip})` }, svg);

      for (const line of panel.lines) {
        const s = series(line.slug), y = axes[line.axis === 'right' ? 'right' : 'left'].y;
        if (line.band) {
          const [lo, hi] = line.band.map(series);
          let d = '';
          lo.obs.forEach((o, i) => {
            const end = lo.obs[i + 1]?.t ?? to, top = hi.obs[i]?.v ?? o.v;
            if (end < from || o.t > to) return;
            d += `M${x(o.t)},${y(top)}H${x(end)}V${y(o.v)}H${x(o.t)}Z`;
          });
          el('path', { d, class: 'gg-band', style: `fill:${line.color}` }, plot);
        }
        let d = '', prev = null;
        const gap = { daily: 12, weekly: 12, 'four-week-average': 12, monthly: 50, quarterly: 100, annual: 400, 'fiscal-year': 400, irregular: Infinity }[s.frequency] * DAY;
        s.obs.forEach((o, i) => {
          if (o.t > to + 400 * DAY) return;
          const end = periodEnd(o.t, s.frequency, s.obs[i + 1]?.t);
          if (end < from - 400 * DAY) return;
          const broken = prev && o.t - prev.t > gap * (s.frequency === 'monthly' ? 1 : 1.8);
          if (COARSE.has(s.frequency)) {
            const segEnd = s.frequency === 'irregular' ? (s.obs[i + 1]?.t ?? to) : end;
            d += `${!prev || broken ? 'M' : 'L'}${x(o.t)},${y(o.v)}H${x(segEnd)}`;
          } else {
            const mid = s.frequency === 'monthly' ? o.t + 15 * DAY : o.t;
            d += `${!prev || broken ? 'M' : 'L'}${x(mid)},${y(o.v)}`;
          }
          prev = o;
        });
        el('path', { d, class: `gg-line ${COARSE.has(s.frequency) ? 'gg-step' : ''}`, style: `stroke:${line.color}` }, plot);
      }
      cursors.push({ svg, height: panelHeight + M.t + M.b, lines: panel.lines.map(l => ({ ...l, s: series(l.slug), y: axes[l.axis === 'right' ? 'right' : 'left'].y })) });
    });

    // Date axis.
    const axis = el('svg', { width, height: 22, class: 'gg-xaxis' }, root);
    const years = (to - from) / (365.25 * DAY);
    const every = years > 30 ? 5 : years > 14 ? 2 : 1;
    for (let yv = new Date(from).getUTCFullYear(); yv <= new Date(to).getUTCFullYear(); yv++) {
      const t = Date.UTC(yv, 0, 1); if (t < from || yv % every) continue;
      el('line', { x1: x(t), x2: x(t), y1: 0, y2: 5, class: 'gg-grid' }, axis);
      const tx = el('text', { x: x(t), y: 17, 'text-anchor': 'middle', class: 'gg-tick' }, axis); tx.textContent = yv;
    }
    root.appendChild(readout);

    // Shared cursor.
    for (const c of cursors) {
      c.rule = el('line', { y1: 0, y2: c.height, class: 'gg-cursor', visibility: 'hidden' }, c.svg);
      c.dots = c.lines.map(l => el('circle', { r: 3.5, class: 'gg-dot', style: `fill:${l.color}`, visibility: 'hidden' }, c.svg));
    }
    function move(t, clientX) {
      const px = x(t);
      const rows = [];
      for (const c of cursors) {
        c.rule.setAttribute('x1', px); c.rule.setAttribute('x2', px); c.rule.setAttribute('visibility', 'visible');
        c.lines.forEach((l, i) => {
          const o = valueAt(l.s, t);
          const dot = c.dots[i];
          if (o && !o.stale) { dot.setAttribute('cx', px); dot.setAttribute('cy', l.y(o.v)); dot.setAttribute('visibility', 'visible'); } else dot.setAttribute('visibility', 'hidden');
          rows.push(`<div class="gg-row${o?.stale ? ' stale' : ''}"><i style="background:${l.color}"></i><span>${l.label ?? label(l.slug)}</span><b>${o ? formatValue(o.v, l.s.dollars ? '$' : l.s.unit) : '—'}</b><small>${o ? (o.stale ? 'last: ' : '') + periodLabel(o.t, l.s.frequency, l.s.shown) : 'not published yet'}</small></div>`);
        });
      }
      const pres = window.GG_CONTEXT.presidents.filter(p => ms(p[2]) <= t).at(-1);
      const rec = window.GG_CONTEXT.recessions.some(([a, b]) => t >= ms(a) && t <= ms(b));
      readout.innerHTML = `<div class="gg-readout-date">${shortDate(t)}${pres ? ` · ${pres[0]}` : ''}${rec ? ' · <span class="gg-rec">during a recession</span>' : ''}</div>${rows.join('')}`;
      readout.style.display = 'block';
      const box = root.getBoundingClientRect();
      const left = clientX - box.left;
      readout.style.left = `${left > box.width / 2 ? left - readout.offsetWidth - 16 : left + 16}px`;
      opts.onCursor?.(t);
    }
    root.onmousemove = e => {
      const box = root.getBoundingClientRect(), px = e.clientX - box.left;
      if (px < M.l || px > M.l + W) return;
      move(tAt(px), e.clientX);
    };
    root.onmouseleave = () => {
      readout.style.display = 'none';
      for (const c of cursors) { c.rule.setAttribute('visibility', 'hidden'); c.dots.forEach(d => d.setAttribute('visibility', 'hidden')); }
    };
  }

  // A tiny line for menus and cards: the whole series, no axes.
  function sparkline(slug, w = 96, hgt = 22, from = ms('1993-01-01')) {
    const s = series(slug); if (!s) return '';
    const o = s.obs.filter(p => p.t >= from); if (o.length < 2) return '';
    const lo = Math.min(...o.map(p => p.v)), hi = Math.max(...o.map(p => p.v));
    const t0 = Math.max(from, s.first), t1 = s.last;
    const step = Math.max(1, Math.floor(o.length / 160));
    const pts = o.filter((_, i) => i % step === 0).map(p => `${(((p.t - t0) / (t1 - t0)) * w).toFixed(1)},${(hgt - 2 - ((p.v - lo) / (hi - lo || 1)) * (hgt - 4)).toFixed(1)}`);
    return `<svg class="gg-spark" width="${w}" height="${hgt}" viewBox="0 0 ${w} ${hgt}"><polyline points="${pts.join(' ')}"/></svg>`;
  }

  // Coverage: where a series has values over [from, to], as a thin bar (for layer lists).
  function coverage(slug, from, to, w = 120) {
    const s = series(slug);
    const a = Math.max(s.first, from), b = Math.min(s.last, to);
    const pos = t => ((t - from) / (to - from)) * w;
    return `<svg class="gg-cov" width="${w}" height="6"><rect class="gg-cov-all" x="0" y="2" width="${w}" height="2"/>${b > a ? `<rect class="gg-cov-on f-${s.freq.code}" x="${pos(a)}" y="0" width="${Math.max(2, pos(b) - pos(a))}" height="6"/>` : ''}</svg>`;
  }

  function freqBadge(slug) {
    const s = series(slug);
    const title = s.shown ? `${s.freq.name}, shown as ${s.shown}` : s.freq.name;
    return `<abbr class="gg-freq f-${s.freq.code}" title="${title}">${s.freq.code}</abbr>`;
  }

  // Every series known, for plain name search beyond the topics.
  function searchSeries(q) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return Object.keys(RAW).filter(slug => !slug.startsWith('fed-target')).map(series).filter(s => {
      const hay = `${s.name} ${s.description ?? ''} ${s.category ?? ''} ${s.sourceName}`.toLowerCase();
      return words.every(w => hay.includes(w));
    });
  }
  function searchTopics(q) {
    const t = q.toLowerCase().trim(); if (!t) return [];
    return window.GG_TOPICS.map(topic => {
      const names = [topic.label.toLowerCase(), ...topic.aliases];
      const score = names.some(n => n === t) ? 3 : names.some(n => n.startsWith(t)) ? 2 : names.some(n => n.includes(t) || t.includes(n)) ? 1 : 0;
      return { topic, score };
    }).filter(r => r.score).sort((a, b) => b.score - a.score).map(r => r.topic);
  }

  // Colours: each line keeps its slot while shown.
  const PALETTE = ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)', 'var(--cat-5)', 'var(--cat-6)', 'var(--cat-7)', 'var(--cat-8)'];
  function colorKeeper() {
    const slots = new Map();
    return {
      get(slug) {
        if (!slots.has(slug)) { const used = new Set(slots.values()); slots.set(slug, PALETTE.findIndex((_, i) => !used.has(i)) % PALETTE.length); }
        return PALETTE[slots.get(slug) < 0 ? 0 : slots.get(slug)];
      },
      free(slug) { slots.delete(slug); },
    };
  }

  window.GG = {
    series, groupPanels, wouldShare, render, sparkline, coverage, freqBadge, searchSeries, searchTopics, colorKeeper,
    label, formatValue, periodLabel, shortDate, ms, FREQ, unitFamily, panelTitle, panelKey, h,
    topic: id => window.GG_TOPICS.find(t => t.id === id),
    eventsFor: sets => window.GG_CONTEXT.events.filter(e => sets.includes(e.set)).concat(sets.includes('fomc') ? fomcEvents() : []),
  };

  function fomcEvents() {
    const up = series('fed-target-upper');
    return up.obs.slice(1).map((o, i) => ({
      date: new Date(o.t).toISOString().slice(0, 10), set: 'fomc', ref: 'FOMC',
      label: `Target ${o.v > up.obs[i].v ? 'raised' : 'lowered'} to ${o.v.toFixed(2)}%`,
    }));
  }
})();
