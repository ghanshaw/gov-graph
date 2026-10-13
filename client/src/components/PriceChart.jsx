import { useState, useRef, useLayoutEffect, useId } from 'react';
import { scaleTime, scaleLinear, line, area, bisector, extent, curveStepAfter } from 'd3';
import { formatValue, formatTick, periodLabel, gapBreaks, isPrice, stepBand, bandOn, formatBand, GAP_DAYS } from '../economy';

// A line chart of one economic series over time (Economy.jsx). Colours are in index.css
// (.price-chart, token --economic); positions only are set here. A gap in the publisher's data
// (October 2025 in the BLS series, not collected) is a break in the line, not a straight join.

const HEIGHT = 380;
const M = { top: 30, right: 16, bottom: 30, left: 56 };
// The plot area's left and right margins, for lining something up with it (the period slider).
export const CHART_INSET = [M.left, M.right];

const toDate = iso => new Date(iso + 'T00:00:00Z');
const byDate = bisector(o => o.time).center;

const capital = s => s.charAt(0).toUpperCase() + s.slice(1);

// Time axis ticks. Yearly figures are marked by year only (a span of two years would otherwise be
// marked by month): every year, or every 2, 5, 10, … to fit about `count`.
function timeTicks(x, count, annual) {
  if (!annual) return { ticks: x.ticks(count), format: x.tickFormat() };
  const [a, b] = x.domain();
  const first = a.getUTCFullYear() + (a.getUTCMonth() || a.getUTCDate() > 1 ? 1 : 0);
  const last = b.getUTCFullYear();
  const step = [1, 2, 5, 10, 20, 25, 50, 100].find(n => (last - first) / n <= count) ?? 100;
  const ticks = [];
  for (let y = Math.ceil(first / step) * step; y <= last; y += step) ticks.push(new Date(Date.UTC(y, 0, 1)));
  return { ticks, format: t => String(t.getUTCFullYear()) };
}

// `frequency`: how the values are shown — 'daily', 'weekly' (also daily prices averaged by week), 'monthly'.
// `band` (optional): { label, lower, upper } observations of a stepped range drawn behind the line
// (the FOMC target with the federal funds rate).
// `compare` (optional): { label, observations } a second series in the same unit, drawn as its own
// line against the first (`label` names the first): outflows against inflows (outlays against
// receipts, refunds against gross receipts). The space between the lines is shaded in the colour of
// whichever is above; nothing is computed from the two.
export default function PriceChart({ observations, unit, frequency, band = null, label = null, compare = null }) {
  const ref = useRef(null);
  const clipId = useId();
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState(null); // index into points

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    obs.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => obs.disconnect();
  }, []);

  const points = observations.map(o => ({ ...o, time: toDate(o.date) }));
  if (points.length < 2) return <div ref={ref} className="state">No values in this period.</div>;

  const x = scaleTime().domain(extent(points, p => p.time)).range([M.left, width - M.right]);
  const bandPts = band ? stepBand(band.lower, band.upper, points[0].date, points.at(-1).date).map(b => ({ ...b, time: toDate(b.date) })) : [];
  // Zero stays in view unless the series sits far above it; a negative low (WTI, April 2020) shows.
  const other = compare ? compare.observations.map(o => ({ ...o, time: toDate(o.date) })) : [];
  const otherOn = new Map(other.map(o => [o.date, o.value]));
  const [lo, hi] = extent([...points.map(p => p.value), ...other.map(o => o.value), ...bandPts.flatMap(b => [b.lower, b.upper])]);
  const y = scaleLinear().domain([Math.min(0, lo), hi]).nice().range([HEIGHT - M.bottom, M.top]);

  // A null before each value that follows a gap in the publisher's data marks a break.
  const breaks = gapBreaks(points.map(p => p.date), frequency);
  const drawn = points.flatMap((p, i) => (breaks.has(i) ? [null, p] : [p]));
  const path = line().defined(Boolean).x(p => x(p.time)).y(p => y(p.value))(drawn);
  const fill = compare ? null : area().defined(Boolean).x(p => x(p.time)).y0(y(Math.max(0, y.domain()[0]))).y1(p => y(p.value))(drawn);
  const otherBreaks = gapBreaks(other.map(o => o.date), frequency);
  const otherPath = compare ? line().defined(Boolean).x(o => x(o.time)).y(o => y(o.value))(other.flatMap((o, i) => (otherBreaks.has(i) ? [null, o] : [o]))) : null;
  // Between the lines, on the dates both have: clipped above the first line (the second is higher)
  // and below it (the first is higher).
  const paired = compare ? drawn.map(p => (p && otherOn.has(p.date) ? { ...p, other: otherOn.get(p.date) } : null)) : [];
  const between = compare ? area().defined(Boolean).x(p => x(p.time)).y0(p => y(p.value)).y1(p => y(p.other))(paired) : null;
  const edge = compare ? line().defined(Boolean).x(p => x(p.time)).y(p => y(p.value))(drawn) : null;
  const firstX = x(points[0].time), lastX = x(points.at(-1).time);
  const dollars = isPrice(unit);
  // The band as steps: each bound holds until the next change.
  const bandPath = bandPts.length > 1
    ? area().curve(curveStepAfter).x(b => x(b.time)).y0(b => y(b.lower)).y1(b => y(b.upper))(bandPts)
    : null;

  const yTicks = y.ticks(6);
  const { ticks: xTicks, format: xFormat } = timeTicks(x, Math.max(2, Math.floor(width / 110)), frequency === 'annual');

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHover(byDate(points, x.invert(e.clientX - rect.left)));
  };

  const p = hover !== null ? points[hover] : null;
  const tipLeft = p && x(p.time) > width - 200;

  return (
    <div ref={ref} className="price-chart" data-testid="price-chart">
      {compare && (
        <div className="chart-legend">
          <span><i className="swatch inflow" />{label}</span>
          <span><i className="swatch outflow" />{compare.label}</span>
          <span className="legend-note">Shaded: the space between them, in the colour of the higher line</span>
        </div>
      )}
      <svg width={width} height={HEIGHT} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {yTicks.map(v => (
          <g key={v} className={v === 0 ? 'tick zero' : 'tick'}>
            <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} />
            <text x={M.left - 8} y={y(v) + 4} textAnchor="end">{formatTick(v, unit)}</text>
          </g>
        ))}
        {xTicks.map(t => (
          <g key={+t} className="tick">
            <line x1={x(t)} x2={x(t)} y1={HEIGHT - M.bottom} y2={HEIGHT - M.bottom + 5} />
            {/* Labels near either end are anchored inward, so they are not cut off */}
            <text x={x(t)} y={HEIGHT - M.bottom + 19}
              textAnchor={x(t) > width - M.right - 30 ? 'end' : x(t) < M.left + 30 ? 'start' : 'middle'}>{xFormat(t)}</text>
          </g>
        ))}
        {dollars && <text className="unit" x={M.left - 8} y={M.top - 18} textAnchor="end">{unit}</text>}
        {fill && <path className="fill" d={fill} />}
        {compare && (
          <>
            <defs>
              <clipPath id={`${clipId}-above`}><path d={`${edge}L${lastX},${M.top}L${firstX},${M.top}Z`} /></clipPath>
              <clipPath id={`${clipId}-below`}><path d={`${edge}L${lastX},${HEIGHT - M.bottom}L${firstX},${HEIGHT - M.bottom}Z`} /></clipPath>
            </defs>
            <path className="gap outflow" d={between} clipPath={`url(#${clipId}-above)`} />
            <path className="gap inflow" d={between} clipPath={`url(#${clipId}-below)`} />
            <path className="series compare" d={otherPath} />
          </>
        )}
        {bandPath && <path className="band" d={bandPath} />}
        <path className="series" d={path} />
        {p && (
          <g>
            <line className="cursor" x1={x(p.time)} x2={x(p.time)} y1={M.top} y2={HEIGHT - M.bottom} />
            <circle className="marker" cx={x(p.time)} cy={y(p.value)} r={4.5} />
            {otherOn.has(p.date) && <circle className="marker compare" cx={x(p.time)} cy={y(otherOn.get(p.date))} r={4.5} />}
          </g>
        )}
      </svg>
      {p && (
        <div className="price-tip" style={{ left: tipLeft ? x(p.time) - 12 : x(p.time) + 12, top: M.top, transform: tipLeft ? 'translateX(-100%)' : undefined }}>
          {compare ? (
            <>
              <div className="tip-line"><i className="swatch inflow" />{label} <b>{formatValue(p.value, unit)}</b></div>
              <div className="tip-line"><i className="swatch outflow" />{compare.label} <b>{otherOn.has(p.date) ? formatValue(otherOn.get(p.date), unit) : '—'}</b></div>
            </>
          ) : <><b>{formatValue(p.value, unit)}</b> {dollars && <span>{unit}</span>}</>}
          <div>{capital(periodLabel(p.date, frequency))}</div>
          {band && bandOn(bandPts, p.date) && <div className="band-value">{band.label} {formatBand(bandOn(bandPts, p.date))}</div>}
        </div>
      )}
    </div>
  );
}

// Several series in one unit on one chart (Economy.jsx, when more than one is chosen). Each line has
// its own colour; nothing is shaded or computed between them. `lines`: [{ key, label, detail,
// color, observations, frequency }]. `domain` ([from, to] dates) is shared by charts stacked one
// above another, so their dates line up; `height` is smaller when they are.
export function LinesChart({ lines, unit, domain, height = HEIGHT }) {
  const ref = useRef(null);
  const [width, setWidth] = useState(800);
  const [hoverTime, setHoverTime] = useState(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    obs.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => obs.disconnect();
  }, []);

  const drawn = lines.map(l => ({ ...l, points: l.observations.map(o => ({ ...o, time: toDate(o.date) })) }))
    .filter(l => l.points.length);
  if (!drawn.length) return <div ref={ref} className="state">No values in this period.</div>;

  const x = scaleTime().domain(domain.map(toDate)).range([M.left, width - M.right]);
  const [lo, hi] = extent(drawn.flatMap(l => l.points.map(p => p.value)));
  const y = scaleLinear().domain([Math.min(0, lo), hi]).nice().range([height - M.bottom, M.top]);
  const paths = drawn.map(l => {
    const breaks = gapBreaks(l.points.map(p => p.date), l.frequency);
    return line().defined(Boolean).x(p => x(p.time)).y(p => y(p.value))(l.points.flatMap((p, i) => (breaks.has(i) ? [null, p] : [p])));
  });

  const yTicks = y.ticks(height < HEIGHT ? 4 : 6);
  const { ticks: xTicks, format: xFormat } = timeTicks(x, Math.max(2, Math.floor(width / 110)), drawn.every(l => l.frequency === 'annual'));
  const dollars = isPrice(unit);

  // Under the pointer: each line's nearest value, if it has one within its own spacing of values.
  const near = hoverTime === null ? [] : drawn.map(l => {
    const p = l.points[byDate(l.points, hoverTime)];
    const days = Math.abs(p.time - hoverTime) / 864e5;
    return days <= (GAP_DAYS[l.frequency] ?? 45) ? { line: l, p } : { line: l, p: null };
  });
  const shown = near.filter(n => n.p);
  const cursorX = hoverTime === null ? null : x(hoverTime);
  const tipLeft = cursorX !== null && cursorX > width - 240;
  const heading = shown[0] && periodLabel(shown[0].p.date, shown[0].line.frequency);

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = x.invert(Math.max(M.left, Math.min(width - M.right, e.clientX - rect.left)));
    setHoverTime(t);
  };

  return (
    <div ref={ref} className="price-chart lines" data-testid="lines-chart">
      <div className="chart-legend">
        {drawn.map(l => (
          <span key={l.key} style={{ '--c': l.color }}><i className="swatch line" />{l.label}{l.detail && <small>{l.detail}</small>}</span>
        ))}
      </div>
      <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHoverTime(null)}>
        {yTicks.map(v => (
          <g key={v} className={v === 0 ? 'tick zero' : 'tick'}>
            <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} />
            <text x={M.left - 8} y={y(v) + 4} textAnchor="end">{formatTick(v, unit)}</text>
          </g>
        ))}
        {xTicks.map(t => (
          <g key={+t} className="tick">
            <line x1={x(t)} x2={x(t)} y1={height - M.bottom} y2={height - M.bottom + 5} />
            <text x={x(t)} y={height - M.bottom + 19}
              textAnchor={x(t) > width - M.right - 30 ? 'end' : x(t) < M.left + 30 ? 'start' : 'middle'}>{xFormat(t)}</text>
          </g>
        ))}
        {dollars && <text className="unit" x={M.left - 8} y={M.top - 18} textAnchor="end">{unit}</text>}
        {drawn.map((l, i) => <path key={l.key} className="series" style={{ stroke: l.color }} d={paths[i]} />)}
        {cursorX !== null && (
          <g>
            <line className="cursor" x1={cursorX} x2={cursorX} y1={M.top} y2={height - M.bottom} />
            {shown.map(({ line: l, p }) => (
              <circle key={l.key} className="marker" style={{ fill: l.color }} cx={x(p.time)} cy={y(p.value)} r={4.5} />
            ))}
          </g>
        )}
      </svg>
      {cursorX !== null && shown.length > 0 && (
        <div className="price-tip" style={{ left: tipLeft ? cursorX - 12 : cursorX + 12, top: M.top, transform: tipLeft ? 'translateX(-100%)' : undefined }}>
          {near.map(({ line: l, p }) => (
            <div key={l.key} className="tip-line" style={{ '--c': l.color }}>
              <i className="swatch line" />{l.label}
              {p && periodLabel(p.date, l.frequency) !== heading && <span>{periodLabel(p.date, l.frequency)}</span>}
              <b>{p ? formatValue(p.value, unit) : '—'}</b>
            </div>
          ))}
          <div>{capital(heading)}</div>
        </div>
      )}
    </div>
  );
}
