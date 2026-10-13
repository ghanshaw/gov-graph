import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Loading from './Loading';
import { formatValue, formatTick, isPrice, periodLabel, gapBreaks, stepBand, bandOn, formatBand } from '../economy';

// The timeline: events of the three branches on either side of a year axis, presidencies and periods
// across the top, and under them the lanes of economic series, all on one time axis. Horizontal only.
// Colours and type are in index.css (.tl-*); inline styles carry positions only.

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// An event opens its page in the app; one with no page (a Bush order) is not a link.
function EventLink({ event, children }) {
  return event.href ? <Link to={event.href}>{children}</Link> : children;
}

// 100% fits the selected years to the visible width; zooming in makes the chart scroll.
const ZOOM_MIN = 1;
const ZOOM_MAX = 30;
// Years between labels on the axis, the smallest that leaves this much room for each label.
const LABEL_STEPS = [1, 2, 5, 10, 20, 50];
const LABEL_ROOM = 48;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Room either side of the time axis, for the lanes' scales; the year range above lines up with it.
export const PADDING = 48;

const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

const BLURB_W = 150;
const BLURB_H = 38;
const BLURB_GAP = 6; // min px gap between blurbs at same level

// Greedy level assignment: the lowest level with no overlap along the time axis.
function assignLevels(events, toX) {
  const levelMaxX = [];
  return events.map(event => {
    const x = toX(event.date);
    let level = 0;
    while (levelMaxX[level] !== undefined && x < levelMaxX[level] + BLURB_W + BLURB_GAP) level++;
    levelMaxX[level] = x;
    return { ...event, level };
  });
}

// Lanes: each a chart of one or more series under the events, sharing their time axis.
const LANE_GAP = 34;    // above each lane
const LANE_HEAD = 34;   // the legend, and the unit above the scale
const LANE_H = 190;     // the plot
const LANE_FOOT = 26;   // the years under the plot
const MAX_STEPS = 5;

// Gridlines: the smallest round step (1, 2, 2.5 or 5 × a power of ten) that covers [lo, hi] in at
// most five steps. Not forced to include zero, so a series between 2% and 9% is not flattened.
function niceScale(lo, hi) {
  const span = hi - lo || Math.abs(hi) || 1;
  let pow = 10 ** Math.floor(Math.log10(span / MAX_STEPS));
  for (;;) {
    for (const m of [1, 2, 2.5, 5]) {
      const step = m * pow;
      const min = Math.floor(lo / step) * step;
      const max = Math.max(min + step, Math.ceil(hi / step) * step);
      if ((max - min) / step <= MAX_STEPS) return { min, max, step };
    }
    pow *= 10;
  }
}

// The cursor snaps to an event this close to the pointer (px), and passes through every event
// within HIT of it: those are highlighted together with the values there.
const SNAP = 8;
const HIT = 5;
const CARD_EVENTS = 6;

// Presidencies: a strip across the top, one segment per president (consecutive terms joined),
// coloured by party; a dashed line through every lane where it changes.
const TERMS_H = 22;
const TERMS_TOP = 6;
// Periods (recessions, emergencies): bars in rows under the presidencies, labelled, and shading
// through every lane below them (recessions hatched).
const PERIOD_H = 15;
const PERIOD_GAP = 4;
const periodClass = kind => (kind === 'recession' ? 'recession' : 'emergency');
const PERIOD_SHORT = { recession: 'Recession', public_health_emergency: 'Health emergency', national_emergency: 'National emergency' };

/** Rows for periods, greedily: each takes the first row whose last period has ended before it starts. */
function periodRows(periods) {
  const ends = [];
  return periods.map(p => {
    let row = ends.findIndex(end => end < p.start);
    if (row < 0) row = ends.length;
    ends[row] = p.end ?? '9999-12-31';
    return { ...p, row };
  });
}
const partyClass = party => (/^democrat/i.test(party ?? '') ? 'dem' : /^republican/i.test(party ?? '') ? 'rep' : 'other');

/** Consecutive terms of one person → one presidency { personId, name, lastName, party, href, start, end, terms }. */
function presidencies(terms) {
  const out = [];
  for (const term of terms ?? []) {
    const last = out.at(-1);
    if (last && last.personId === term.personId && last.end === term.start) {
      last.end = term.end;
      last.terms.push(term);
    } else {
      out.push({ ...term, terms: [term] });
    }
  }
  return out;
}

// How long a value stands for, in days, by how often it is published (for the value under the cursor).
const WITHIN = { daily: 7, weekly: 7, 'four-week-average': 7, monthly: 31, quarterly: 92, annual: 366, 'fiscal-year': 366, irregular: Infinity };
// Values that stand for a quarter or a year are drawn at the middle of the period they stand for,
// joined by a line; an irregular series (a rate that holds until changed) as a level until the next.
const STEPPED = new Set(['quarterly', 'annual', 'fiscal-year', 'irregular']);
const addMonths = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};
const periodEnd = (iso, frequency, next) => (frequency === 'quarterly' ? addMonths(iso, 3)
  : frequency === 'annual' || frequency === 'fiscal-year' ? addMonths(iso, 12) : next);

// The value in force on an ISO date: the latest observation on or before it, within `days`.
function observationOn(obs, iso, days = 7) {
  let lo = 0, hi = obs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (obs[mid].date <= iso) lo = mid + 1; else hi = mid;
  }
  const o = obs[lo - 1];
  return o && (Date.parse(iso) - Date.parse(o.date)) / 864e5 < days ? o : null;
}

const isoDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * lanes: [{ key, title, lines: [{ slug, name, color, axis: 'left' | 'right', unit, frequency (as shown),
 *   observations, band: { name, lower, upper } | null }] }]. `loading`: slugs still being fetched.
 */
export default function TimelineChart({ events, rangeStart, rangeEnd, terms = null, periods = null, lanes = [], loading = new Set() }) {
  // The pointer: its x on the chart, and where it is in the container (for the card).
  const [cursor, setCursor] = useState(null);
  const navigate = useNavigate();
  const [zoom, setZoom] = useState(1);
  const [view, setView] = useState('dots'); // 'dots' | 'blurbs'
  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  // The visible width of the scrolling area, which 100% zoom fills.
  const [viewW, setViewW] = useState(0);
  const [scrollEl, setScrollEl] = useState(null);
  const attachScroll = useCallback(el => { scrollRef.current = el; setScrollEl(el); }, []);
  // How far the chart is scrolled sideways, so labels and scales stay in the visible part.
  const [scrollX, setScrollX] = useState(0);
  useEffect(() => {
    if (!scrollEl) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScrollX(scrollEl.scrollLeft));
    };
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => { scrollEl.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, [scrollEl]);
  // Zooming keeps the same date under the focus: the pointer for a wheel or pinch, the middle of the
  // visible part for the buttons. Before the zoom the focus is noted as a fraction of the time axis;
  // after it, the chart is scrolled to put that fraction back under the focus.
  const anchorRef = useRef(null);
  const anchorAt = useCallback((client) => {
    const el = scrollRef.current;
    const svg = el?.querySelector('svg');
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const focus = client ?? el.getBoundingClientRect().left + el.clientWidth / 2;
    anchorRef.current = { frac: (focus - r.left - PADDING) / (r.width - PADDING * 2), focus };
  }, []);
  const zoomBy = factor => { anchorAt(null); setZoom(z => clamp(z * factor, ZOOM_MIN, ZOOM_MAX)); };

  useLayoutEffect(() => {
    const a = anchorRef.current;
    anchorRef.current = null;
    const el = scrollRef.current;
    const svg = el?.querySelector('svg');
    if (!a || !svg) return;
    const r = svg.getBoundingClientRect();
    el.scrollLeft += r.left + PADDING + a.frac * (r.width - PADDING * 2) - a.focus;
  }, [zoom]);

  useLayoutEffect(() => {
    if (!scrollEl) return;
    const obs = new ResizeObserver(entries => setViewW(entries[0].contentRect.width));
    obs.observe(scrollEl);
    return () => obs.disconnect();
  }, [scrollEl]);

  // Scrolling up or down over the chart zooms; sideways scrolls it.
  useEffect(() => {
    const el = scrollEl;
    if (!el) return;
    const onWheel = (e) => {
      if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        anchorAt(e.clientX);
        setZoom(z => clamp(z * (e.deltaY > 0 ? 1 / 1.12 : 1.12), ZOOM_MIN, ZOOM_MAX));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [scrollEl, anchorAt]);

  const hasData = (events?.length ?? 0) > 0;
  // A lane still being fetched keeps its place, with a spinner, so the chart does not jump.
  const shownLanes = lanes.filter(l => l.lines.length || l.loading);
  if (!hasData && !shownLanes.length && !terms?.length && !periods?.length) return null;

  const startIso = `${rangeStart}-01-01`, endIso = `${rangeEnd}-12-31`;
  const visibleMin = new Date(`${rangeStart}-01-01T00:00:00`).getTime();
  const visibleMax = new Date(`${rangeEnd}-12-31T23:59:59`).getTime();
  const rangeYears = rangeEnd - rangeStart + 1;
  const totalWidth = Math.max(viewW || 800, 320) * zoom;
  const perYear = (totalWidth - PADDING * 2) / rangeYears;
  const labelStep = LABEL_STEPS.find(step => step * perYear >= LABEL_ROOM) ?? LABEL_STEPS.at(-1);
  const toX = iso => ((new Date(iso + 'T00:00:00').getTime() - visibleMin) / (visibleMax - visibleMin)) * (totalWidth - PADDING * 2) + PADDING;

  // Above the axis the President, Congress and reports of investigations; below it the Supreme Court
  // and the Federal Reserve.
  const BELOW_KINDS = ['scotus', 'fomc'];
  const allAbove = events.filter(e => !BELOW_KINDS.includes(e.kind));
  const aboveLabel = [['PRESIDENT', ['eo', 'memo']], ['CONGRESS', ['law']], ['REPORTS', ['report']]]
    .filter(([, kinds]) => allAbove.some(e => kinds.includes(e.kind))).map(([label]) => label).join(' · ');
  const allBelow = events.filter(e => BELOW_KINDS.includes(e.kind));
  const belowLabel = ['SUPREME COURT', 'FEDERAL RESERVE'].filter((_, i) => allBelow.some(e => e.kind === BELOW_KINDS[i])).join(' · ');
  const inView = e => e.date >= startIso && e.date <= endIso;
  const above = allAbove.filter(inView);
  const below = allBelow.filter(inView);

  const DOT_R = 5;
  const STEP = BLURB_H + 8;
  const aboveLeveled = view === 'blurbs' ? assignLevels(above, toX) : above;
  const belowLeveled = view === 'blurbs' ? assignLevels(below, toX) : below;
  const maxLevel = list => Math.max(0, ...list.map(e => e.level ?? 0));

  // Down the chart: presidencies, the period rows, the events either side of the axis, then the lanes.
  const shownPresidencies = presidencies(terms).filter(p => p.start <= endIso && (!p.end || p.end > startIso));
  const shownPeriods = periodRows((periods ?? []).filter(p => p.start <= endIso && (!p.end || p.end >= startIso)));
  const periodRowCount = Math.max(0, ...shownPeriods.map(p => p.row + 1));
  const PERIODS_Y = TERMS_TOP + (shownPresidencies.length ? TERMS_H + 6 : 0);
  const stripsEnd = PERIODS_Y + periodRowCount * (PERIOD_H + PERIOD_GAP);
  const TOP = stripsEnd > TERMS_TOP ? stripsEnd + 10 : 0;
  // With no events shown, the event lanes close up to just the year axis.
  const AXIS_Y = TOP + (!hasData ? 12 : view === 'blurbs' ? 52 + (maxLevel(aboveLeveled) + 1) * STEP : 110);
  const ABOVE_Y = AXIS_Y - 42;
  const BELOW_Y = AXIS_Y + 42;
  const EVENTS_END = !hasData ? AXIS_Y + 34 : view === 'blurbs' ? AXIS_Y + 52 + (maxLevel(belowLeveled) + 1) * STEP : TOP + 220;
  const laneTop = i => EVENTS_END + LANE_GAP + i * (LANE_HEAD + LANE_H + LANE_FOOT + LANE_GAP);
  const svgH = shownLanes.length ? laneTop(shownLanes.length) - LANE_GAP + 10 : EVENTS_END;

  const years = [];
  for (let y = rangeStart; y <= rangeEnd; y++) years.push(y);
  // Zoomed in, months between the years: ticks once a month has room, labelled every month or quarter.
  const perMonth = perYear / 12;
  const monthLabelStep = perMonth >= LABEL_ROOM ? 1 : perMonth * 3 >= LABEL_ROOM ? 3 : 0;
  const months = perMonth >= 8 ? years.flatMap(y => MONTH_NAMES.slice(1).map((name, i) => ({ year: y, month: i + 1, name }))) : [];

  // The part of the time axis in view, for labels and scales that stay on screen when zoomed in.
  const viewX = viewW ? [scrollX, scrollX + viewW] : [0, totalWidth];
  const visibleMid = (x0, x1) => {
    const a = Math.max(x0, viewX[0]), b = Math.min(x1, viewX[1]);
    return b > a ? { x: (a + b) / 2, room: b - a } : { x: (x0 + x1) / 2, room: x1 - x0 };
  };
  const leftEdge = Math.max(0, viewX[0]);
  const rightEdge = Math.min(totalWidth, viewX[1]);

  // Each lane's series within the years shown, its scales, and its band.
  const laneData = shownLanes.map((lane, i) => {
    const top = laneTop(i) + LANE_HEAD;
    const lines = lane.lines.map(l => {
      // A stepped series keeps the value in force when the years shown begin.
      const firstIn = l.observations.findIndex(o => o.date >= startIso);
      const from = STEPPED.has(l.frequency) && firstIn > 0 ? firstIn - 1 : Math.max(0, firstIn);
      const obs = firstIn < 0 ? (STEPPED.has(l.frequency) ? l.observations.slice(-1) : []) : l.observations.slice(from).filter(o => o.date <= endIso);
      const band = l.band && obs.length ? stepBand(l.band.lower, l.band.upper, startIso, obs.at(-1).date) : [];
      return { ...l, obs, bandSteps: band };
    });
    const scales = {};
    for (const side of ['left', 'right']) {
      const own = lines.filter(l => (l.axis === 'right' ? 'right' : 'left') === side);
      const values = own.flatMap(l => [...l.obs.map(o => o.value), ...l.bandSteps.flatMap(b => [b.lower, b.upper])]);
      if (!own.length) continue;
      const sc = values.length ? niceScale(Math.min(...values), Math.max(...values)) : { min: 0, max: 1, step: 1 };
      scales[side] = { ...sc, unit: own[0].unit, toY: v => top + LANE_H - ((v - sc.min) / (sc.max - sc.min)) * LANE_H };
    }
    return { ...lane, top, lines, scales };
  });

  // The cursor: one line through every lane at the pointer's date, snapped to the nearest event.
  const onPointer = (e) => {
    const svg = e.currentTarget.getBoundingClientRect();
    const box = containerRef.current?.getBoundingClientRect();
    const x = e.clientX - svg.left;
    if (!box || x < PADDING || x > totalWidth - PADDING) return setCursor(null);
    setCursor({ x, cx: e.clientX - box.left, width: box.width });
  };
  const shownEvents = [...above, ...below];
  let cursorX = null, cursorDate = null, hits = [];
  if (cursor) {
    let nearest = null;
    for (const e of shownEvents) {
      const d = Math.abs(toX(e.date) - cursor.x);
      if (d <= SNAP && (!nearest || d < nearest.d)) nearest = { e, d };
    }
    cursorX = nearest ? toX(nearest.e.date) : cursor.x;
    cursorDate = nearest ? nearest.e.date
      : isoDay(new Date(visibleMin + ((cursorX - PADDING) / (totalWidth - PADDING * 2)) * (visibleMax - visibleMin)));
    hits = shownEvents.filter(e => Math.abs(toX(e.date) - cursorX) <= HIT).sort((a, b) => a.date.localeCompare(b.date));
  }
  // Each series' value on the cursor's date, lane by lane.
  const valuesAt = cursorDate ? laneData.map(lane => ({
    lane,
    rows: lane.lines.map(l => ({ line: l, at: observationOn(l.obs, cursorDate, WITHIN[l.frequency] ?? 7), band: l.bandSteps.length ? bandOn(l.bandSteps, cursorDate) : null })),
  })) : [];
  const anyValue = valuesAt.some(v => v.rows.some(r => r.at));
  const hitIds = new Set(hits.map(e => e.id));
  const presidentAt = cursorDate ? shownPresidencies.find(p => p.start <= cursorDate && (!p.end || cursorDate < p.end)) : null;
  const periodsAt = cursorDate ? shownPeriods.filter(p => p.start <= cursorDate && (!p.end || cursorDate <= p.end)) : [];
  const hitDates = [...new Set(hits.map(e => e.date))];
  const cardHead = hitDates.length > 1 ? `${formatDate(hitDates[0])} – ${formatDate(hitDates.at(-1))}` : formatDate(cursorDate);
  const open = event => event.href && navigate(event.href);

  const renderDot = (event, side) => {
    const x = toX(event.date);
    const hovered = hitIds.has(event.id);
    const isAbove = side === 'above';
    const y = isAbove ? ABOVE_Y : BELOW_Y;
    return (
      <g key={event.id} data-testid={`timeline-event-${event.id}`} data-event-type={event.kind} data-event-date={event.date}
        className={`tl-event ${event.kind}${hovered ? ' hovered' : ''}`} onClick={() => open(event)}>
        <line x1={x} x2={x} y1={isAbove ? y + DOT_R : AXIS_Y} y2={isAbove ? AXIS_Y : y - DOT_R} strokeWidth={1} />
        <circle cx={x} cy={y} r={hovered ? DOT_R + 2 : DOT_R} />
      </g>
    );
  };

  const renderBlurb = (event, side) => {
    const x = toX(event.date);
    const level = event.level ?? 0;
    const isAbove = side === 'above';
    const nearY = isAbove ? AXIS_Y - 52 - level * STEP : AXIS_Y + 52 + level * STEP;
    const boxY = isAbove ? nearY - BLURB_H : nearY;
    const title = (event.title || '').length > 28 ? event.title.slice(0, 27) + '…' : (event.title || '');
    return (
      <g key={event.id} data-testid={`timeline-event-${event.id}`} data-event-type={event.kind} data-event-date={event.date}
        className={`tl-event blurb ${event.kind}${hitIds.has(event.id) ? ' hovered' : ''}`}>
        <line x1={x} x2={x} y1={AXIS_Y} y2={nearY} strokeWidth={1} />
        <circle cx={x} cy={AXIS_Y} r={3} />
        <EventLink event={event}>
          <rect x={x - BLURB_W / 2} y={boxY} width={BLURB_W} height={BLURB_H} rx={4} strokeWidth={1} />
          <text className="kind" x={x} y={boxY + 13} textAnchor="middle" fontSize={8.5} letterSpacing="0.08em">{(event.label || '').toUpperCase()}</text>
          <text className="name" x={x} y={boxY + 27} textAnchor="middle" fontSize={9.5}>{title}</text>
        </EventLink>
      </g>
    );
  };

  // Where a value sits along the time axis: a quarter's or a year's at its middle, others on their date.
  const xOf = (l, o) => {
    if (!STEPPED.has(l.frequency) || l.frequency === 'irregular') return toX(o.date);
    const end = periodEnd(o.date, l.frequency, null);
    return (toX(o.date) + toX(end)) / 2;
  };

  // A period's span along the time axis, clipped to the selected years.
  const periodSpan = p => [toX(p.start < startIso ? startIso : p.start), toX(!p.end || p.end > endIso ? endIso : p.end)];

  // Shading behind everything below the strips, drawn first; recessions are hatched.
  const renderPeriodShading = () => shownPeriods.map(p => {
    const [x0, x1] = periodSpan(p);
    return <rect key={p.slug} className={`tl-period-shade ${periodClass(p.kind)}`} x={x0} y={stripsEnd} width={Math.max(1, x1 - x0)} height={Math.max(0, svgH - stripsEnd)} />;
  });

  // One bar per period in its row, labelled; clicking opens the document that began it.
  const renderPeriods = () => shownPeriods.map(p => {
    const [x0, x1] = periodSpan(p);
    const y = PERIODS_Y + p.row * (PERIOD_H + PERIOD_GAP);
    const seen = visibleMid(x0, x1);
    const label = [p.name, PERIOD_SHORT[p.kind], p.kind === 'recession' ? p.start.slice(0, 4) : null].find(text => text && seen.room > 6.2 * text.length + 10) ?? '';
    const openPeriod = () => (p.startHref ? navigate(p.startHref) : p.startUrl && window.open(p.startUrl, '_blank', 'noopener'));
    return (
      <g key={p.slug} className={`tl-period ${periodClass(p.kind)}${periodsAt.includes(p) ? ' on' : ''}`}
        data-testid={`timeline-period-${p.slug}`} onClick={openPeriod} role="link"
        aria-label={`${p.name}, ${formatDate(p.start)} to ${p.end ? formatDate(p.end) : 'now'}`}>
        <rect x={x0} y={y} width={Math.max(1, x1 - x0)} height={PERIOD_H} rx={3} />
        {label && <text x={seen.x} y={y + PERIOD_H / 2} dy="0.35em" textAnchor="middle" fontSize={10}>{label}</text>}
      </g>
    );
  });

  // The presidencies strip, and a dashed line through everything below where the president changes.
  const renderPresidencies = () => shownPresidencies.map((p, i) => {
    const x0 = toX(p.start < startIso ? startIso : p.start);
    const x1 = toX(!p.end || p.end > endIso ? endIso : p.end);
    const seen = visibleMid(x0, x1);
    const label = seen.room > 7 * p.name.length ? p.name : seen.room > 8 * (p.lastName ?? '').length + 12 ? p.lastName : '';
    return (
      <g key={p.start} className={`tl-term ${partyClass(p.party)}${presidentAt === p ? ' on' : ''}`}
        data-testid="timeline-presidency" onClick={() => navigate(p.href)}>
        <rect x={x0} y={TERMS_TOP} width={Math.max(0, x1 - x0)} height={TERMS_H} />
        {p.terms.slice(1).filter(t => t.start > startIso && t.start <= endIso).map(t => (
          <line key={t.start} className="tl-term-tick" x1={toX(t.start)} x2={toX(t.start)} y1={TERMS_TOP} y2={TERMS_TOP + TERMS_H} strokeWidth={1} />
        ))}
        {label && <text x={seen.x} y={TERMS_TOP + TERMS_H / 2} dy="0.35em" textAnchor="middle" fontSize={11}>{label}</text>}
      </g>
    );
  });

  // A series as a path: a line through its values, broken where the publisher's data has a gap;
  // a quarterly or yearly series as a level across each period it stands for.
  const pathOf = (l, toY) => {
    const breaks = gapBreaks(l.obs.map(o => o.date), l.frequency);
    let d = '';
    l.obs.forEach((o, i) => {
      const x = xOf(l, o).toFixed(1), y = toY(o.value).toFixed(1);
      d += `${!i || breaks.has(i) ? 'M' : 'L'}${x},${y}`;
      if (l.frequency === 'irregular') d += `H${toX(l.obs[i + 1]?.date ?? endIso).toFixed(1)}`;
    });
    return d;
  };

  // A lane: its title and legend at the visible left edge, gridlines with the scale either side,
  // the band behind, the lines, and the markers at the cursor.
  const renderLane = (lane, i) => {
    const { top, scales } = lane;
    const left = scales.left ?? scales.right;
    if (!left) {
      return (
        <g key={lane.key} className="tl-lane-chart" data-testid={`timeline-lane-${i + 1}`}>
          <foreignObject width={48} height={48} x={(leftEdge + rightEdge) / 2 - 24} y={top + LANE_H / 2 - 24}><Loading small label="Loading series…" /></foreignObject>
        </g>
      );
    }
    const grid = [];
    for (let v = left.min; v <= left.max + 1e-9; v += left.step) grid.push(+v.toFixed(6));
    const ticks = side => {
      const sc = scales[side];
      if (!sc) return null;
      const out = [];
      for (let v = sc.min; v <= sc.max + 1e-9; v += sc.step) out.push(+v.toFixed(6));
      return out.map(v => (
        <text key={`${side}${v}`} className={side === 'left' ? (leftEdge > 0 ? 'scale pinned' : 'scale') : 'scale pinned'} fontSize={11}
          x={side === 'left' ? leftEdge + PADDING - 6 : rightEdge - PADDING + 6} y={sc.toY(v) + 3} textAnchor={side === 'left' ? 'end' : 'start'}>
          {formatTick(v, sc.unit)}
        </text>
      ));
    };
    // The legend: each series' name with its colour, one after another (an estimate of the text's width).
    let legendX = leftEdge + PADDING;
    const legend = lane.lines.map(l => {
      const x = legendX;
      legendX += (l.name.length + (l.axis === 'right' ? 8 : 0)) * 6.6 + 34;
      return (
        <g key={l.slug} className="legend" style={{ '--c': l.color }}>
          <line x1={x} x2={x + 14} y1={laneTop(i) + 8} y2={laneTop(i) + 8} />
          <text x={x + 20} y={laneTop(i) + 12} fontSize={12.5}>{l.name}{l.axis === 'right' ? ' (right)' : ''}</text>
        </g>
      );
    });
    // The unit above each scale, only where the ticks do not already carry it ("$/bbl" over 80, not
    // "$" over $50T), as the Economy charts print it.
    const unitLabel = side => scales[side] && isPrice(scales[side].unit) && (
      <text className="scale unit" fontSize={11} x={side === 'left' ? leftEdge + PADDING - 6 : rightEdge - PADDING + 6}
        y={top - 8} textAnchor={side === 'left' ? 'end' : 'start'}>{scales[side].unit}</text>
    );
    // Years under the plot, at the axis's label step.
    const bottom = top + LANE_H;
    const yearTicks = years.filter(y => y % labelStep === 0).map(year => {
      const x = toX(`${year}-01-01`);
      return (
        <g key={year} className="year">
          <line x1={x} x2={x} y1={bottom} y2={bottom + 5} />
          <text x={x} y={bottom + 19} textAnchor="middle" fontSize={11}>{year}</text>
        </g>
      );
    });
    const single = lane.lines.length === 1 && !scales.right;
    const lanesLoading = lane.loading || lane.lines.some(l => loading.has(l.slug));
    return (
      <g key={lane.key} className={lanesLoading ? 'tl-lane-chart stale' : 'tl-lane-chart'} data-testid={`timeline-lane-${i + 1}`}>
        {legend}
        {unitLabel('left')}
        {unitLabel('right')}
        {yearTicks}
        {grid.map(v => (
          <line key={v} className={v === 0 ? 'gridline zero' : 'gridline'} x1={PADDING} x2={totalWidth - PADDING} y1={left.toY(v)} y2={left.toY(v)} strokeWidth={1} />
        ))}
        {ticks('left')}
        {ticks('right')}
        <g clipPath="url(#tl-lanes-clip)">
          {lane.lines.map(l => {
            const sc = scales[l.axis === 'right' ? 'right' : 'left'];
            const band = l.bandSteps;
            return (
              <g key={l.slug} style={{ '--c': l.color }} data-testid={`timeline-line-${l.slug}`}>
                {band.length > 1 && <path className="band" d={band.slice(0, -1).map((b, k) => {
                  const x0 = toX(b.date), x1 = toX(band[k + 1].date), y0 = sc.toY(b.upper), y1 = sc.toY(b.lower);
                  return `M${x0.toFixed(1)},${y0.toFixed(1)}H${x1.toFixed(1)}V${y1.toFixed(1)}H${x0.toFixed(1)}Z`;
                }).join('')} />}
                {single && l.obs.length > 1 && <path className="area" d={`${pathOf(l, sc.toY)}V${(top + LANE_H).toFixed(1)}H${xOf(l, l.obs[0]).toFixed(1)}Z`} />}
                <path className="line" d={pathOf(l, sc.toY)} />
              </g>
            );
          })}
        </g>
        {valuesAt[i]?.rows.filter(r => r.at).map(({ line: l, at }) => {
          const sc = scales[l.axis === 'right' ? 'right' : 'left'];
          return <circle key={l.slug} className="marker" style={{ '--c': l.color }} cx={l.frequency === 'irregular' ? cursorX : xOf(l, at)} cy={sc.toY(at.value)} r={4} />;
        })}
        {lanesLoading && (
          <foreignObject width={48} height={48} x={(leftEdge + rightEdge) / 2 - 24} y={top + LANE_H / 2 - 24}>
            <Loading small label="Loading series…" />
          </foreignObject>
        )}
      </g>
    );
  };

  return (
    <div ref={containerRef} data-testid="timeline-chart" className="tl-chart">
      <div data-testid="timeline-zoom-controls" className="tl-toolbar">
        <div>
          {['dots', 'blurbs'].map(v => (
            <button key={v} type="button" aria-pressed={view === v} className={view === v ? 'btn small active' : 'btn small'} onClick={() => setView(v)}>
              {v === 'dots' ? 'Dots' : 'Blurbs'}
            </button>
          ))}
        </div>
        <div>
          <button type="button" data-testid="timeline-zoom-out" className="btn small" aria-label="Zoom out" disabled={zoom <= ZOOM_MIN} onClick={() => zoomBy(1 / 1.5)}>−</button>
          <span data-testid="timeline-zoom-level" className="tl-zoom">{Math.round(zoom * 100)}%</span>
          <button type="button" data-testid="timeline-zoom-in" className="btn small" aria-label="Zoom in" disabled={zoom >= ZOOM_MAX} onClick={() => zoomBy(1.5)}>+</button>
          <button type="button" data-testid="timeline-zoom-reset" className="btn small" disabled={zoom === 1}
            onClick={() => { anchorAt(null); setZoom(1); }}>Reset</button>
        </div>
      </div>

      <div ref={attachScroll} data-testid="timeline-scroll-container" className="tl-scroll">
        <svg data-testid="timeline-svg" width={totalWidth} height={svgH} onMouseMove={onPointer} onMouseLeave={() => setCursor(null)}
          className={hits.some(e => e.href) ? 'pointing' : undefined}>
          <defs>
            <clipPath id="tl-lanes-clip"><rect x={PADDING} y={0} width={Math.max(0, totalWidth - PADDING * 2)} height={svgH} /></clipPath>
            <pattern id="tl-recession-hatch" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect className="hatch-bg" width={6} height={6} />
              <line className="hatch-line" x1={0} y1={0} x2={0} y2={6} strokeWidth={1.4} />
            </pattern>
          </defs>

          {years.filter(year => year % labelStep === 0).map(year => {
            const x = toX(`${year}-01-01`);
            return (
              <g key={year} className="tl-tick">
                <line x1={x} x2={x} y1={AXIS_Y} y2={AXIS_Y + 5} strokeWidth={1} />
                <text x={x} y={AXIS_Y + 20} textAnchor="middle" fontSize={11}>{year}</text>
              </g>
            );
          })}
          {months.map(({ year, month, name }) => {
            const x = toX(`${year}-${String(month + 1).padStart(2, '0')}-01`);
            return (
              <g key={`${year}-${month}`} className="tl-tick month">
                <line x1={x} x2={x} y1={AXIS_Y - 4} y2={AXIS_Y + 4} strokeWidth={1} />
                {monthLabelStep > 0 && month % monthLabelStep === 0 && <text x={x} y={AXIS_Y + 24} textAnchor="middle" fontSize={9.5}>{name}</text>}
              </g>
            );
          })}
          <line className="tl-axis" x1={PADDING} x2={totalWidth - PADDING} y1={AXIS_Y} y2={AXIS_Y} strokeWidth={1.5} />

          {renderPeriodShading()}
          {renderPresidencies()}
          {renderPeriods()}

          {cursorX !== null && (
            <line className={hits.length ? 'tl-cursor on' : 'tl-cursor'} x1={cursorX} x2={cursorX} y1={0} y2={svgH} strokeWidth={1} data-testid="timeline-cursor" />
          )}

          {view === 'dots' && allAbove.length > 0 && (
            <text className="tl-lane" fontSize={9.5} letterSpacing="0.1em" x={leftEdge + PADDING} y={ABOVE_Y - 14}>{aboveLabel}</text>
          )}
          {view === 'dots' && allBelow.length > 0 && (
            <text className="tl-lane" fontSize={9.5} letterSpacing="0.1em" x={leftEdge + PADDING} y={BELOW_Y + 22}>{belowLabel}</text>
          )}

          {view === 'dots'
            ? <>{above.map(e => renderDot(e, 'above'))}{below.map(e => renderDot(e, 'below'))}</>
            : <>{aboveLeveled.map(e => renderBlurb(e, 'above'))}{belowLeveled.map(e => renderBlurb(e, 'below'))}</>}

          {laneData.map(renderLane)}
        </svg>
      </div>

      {/* What the cursor passes through: the date, the president and periods, each lane's values, and
          each event on that line. Beside the pointer, flipped to its left near the right edge. */}
      {cursor && (hits.length > 0 || anyValue || presidentAt || periodsAt.length > 0) && (
        <div data-testid="timeline-cursor-card" className="tl-card" style={{ left: cursor.cx + 320 > cursor.width ? Math.max(0, cursor.cx - 320) : cursor.cx + 16, top: 52 }}>
          <div className="date">{cardHead}</div>
          {presidentAt && <div className={`president ${partyClass(presidentAt.party)}`}><i />{presidentAt.name}</div>}
          {periodsAt.map(p => (
            <div key={p.slug} className={`period ${periodClass(p.kind)}`}>
              <div className="head"><i /><span className="name">{p.name}</span>
                <span className="span">{formatDate(p.start)} – {p.end ? formatDate(p.end) : 'now'}</span></div>
              <div className="end"><b>Began</b> {p.startSource}{p.startBy && <small> · {p.startBy}</small>}</div>
              {p.end && <div className="end"><b>Ended</b> {p.endSource}{p.endBy && <small> · {p.endBy}</small>}</div>}
            </div>
          ))}
          {valuesAt.filter(v => v.rows.some(r => r.at)).map(({ lane, rows }) => (
            <div key={lane.key} className="values">
              {rows.map(({ line: l, at, band }) => (
                <div key={l.slug}>
                  <div className="price" style={{ '--c': l.color }}>
                    <i className="group" /><span className="name">{l.name}</span> <b>{at ? formatValue(at.value, l.unit) : '—'}</b>
                    {at && <small>{periodLabel(at.date, l.frequency)}</small>}
                  </div>
                  {band && <div className="price band-row"><i className="band" style={{ '--c': l.color }} /><span className="name">{l.band.name}</span> <b>{formatBand(band)}</b></div>}
                </div>
              ))}
            </div>
          ))}
          {hits.slice(0, CARD_EVENTS).map((e, i, list) => (
            <div key={e.id} className={`ev ${e.kind}`}>
              {hitDates.length > 1 && e.date !== list[i - 1]?.date && <span className="day">{formatDate(e.date)}</span>}
              <span className="kind">{e.label}</span>
              <span className="name">{e.title}</span>
            </div>
          ))}
          {hits.length > CARD_EVENTS && <div className="more">and {hits.length - CARD_EVENTS} more</div>}
          {hits.length === 1 && hits[0].href && <div className="more">Click to open</div>}
        </div>
      )}
    </div>
  );
}
