import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';

// Colours and type for everything drawn here are in index.css (.range-*, .tl-*).
// Inline styles carry positions only.

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const MIN_WIDTH_PER_YEAR = 220;
const PADDING = 40;

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

// ── Range Selector (exported so Timeline.jsx can place it) ──────────────────

export function RangeSelector({ minYear, maxYear, rangeStart, rangeEnd, onChange }) {
  const containerRef = useRef(null);
  const dragging = useRef(null);
  const [containerW, setContainerW] = useState(800);

  // Measure container width reliably
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      setContainerW(entries[0].contentRect.width);
    });
    obs.observe(el);
    setContainerW(el.getBoundingClientRect().width);
    return () => obs.disconnect();
  }, []);

  const trackW = containerW - PADDING * 2;
  const span   = Math.max(1, maxYear - minYear);

  // Convert year → px from left edge of container
  const yearToPx = useCallback((year) =>
    PADDING + ((year - minYear) / span) * trackW,
  [minYear, span, trackW]);

  // Convert clientX → snapped year
  const xToYear = useCallback((clientX) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return minYear;
    const x = clientX - rect.left - PADDING;
    return Math.round(minYear + (x / trackW) * span);
  }, [minYear, span, trackW]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const year = clamp(xToYear(e.clientX), minYear, maxYear);
      if (dragging.current === 'start') {
        onChange({ start: clamp(year, minYear, rangeEnd - 1), end: rangeEnd });
      } else {
        onChange({ start: rangeStart, end: clamp(year, rangeStart + 1, maxYear) });
      }
    };
    const onUp = () => { dragging.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [minYear, maxYear, rangeStart, rangeEnd, onChange, xToYear]);

  const startX = yearToPx(rangeStart);
  const endX   = yearToPx(rangeEnd);

  const thumb = (which, x, year) => (
    <>
      <div
        data-testid={`timeline-range-handle-${which}`}
        className="range-thumb"
        onMouseDown={e => { e.preventDefault(); dragging.current = which; }}
        style={{ left: x }}
      />
      <div className="range-label" style={{ left: x }}>{year}</div>
    </>
  );

  return (
    <div ref={containerRef} data-testid="timeline-range-selector" className="range">
      {/* Full track */}
      <div data-testid="timeline-range-track" className="range-track" style={{ left: PADDING, width: trackW }} />

      {/* Active fill */}
      <div className="range-fill" style={{ left: startX, width: Math.max(0, endX - startX) }} />

      {thumb('start', startX, rangeStart)}
      {thumb('end',   endX,   rangeEnd)}
    </div>
  );
}

// ── Main Timeline ────────────────────────────────────────────────────────────

const BLURB_W = 150;
const BLURB_H = 38;
const BLURB_GAP = 6; // min px gap between blurbs at same level

function assignLevels(events, toX) {
  // Greedy level assignment: find lowest level with no x overlap
  const levelMaxX = []; // rightmost x used at each level
  return events.map(event => {
    const x = toX(event.date);
    let level = 0;
    while (levelMaxX[level] !== undefined && x < levelMaxX[level] + BLURB_W + BLURB_GAP) {
      level++;
    }
    levelMaxX[level] = x;
    return { ...event, level };
  });
}

export default function HorizontalTimeline({ events, rangeStart, rangeEnd }) {
  const [tooltip, setTooltip] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [view, setView] = useState('dots'); // 'dots' | 'blurbs'
  const containerRef = useRef(null);
  const scrollRef    = useRef(null);

  const dates = (events || []).map(e => new Date(e.date + 'T00:00:00').getTime()).filter(Boolean);
  const hasData = dates.length > 0;
  const minTime = hasData ? Math.min(...dates) : 0;
  const maxTime = hasData ? Math.max(...dates) : 0;
  const minYear = hasData ? new Date(minTime).getFullYear() : 2009;
  const maxYear = hasData ? new Date(maxTime).getFullYear() : 2017;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        setZoom(z => clamp(z * (e.deltaY > 0 ? 1 / 1.12 : 1.12), 0.5, 6));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  if (!hasData) return null;

  const activeStart = rangeStart ?? minYear;
  const activeEnd   = rangeEnd   ?? maxYear;

  // Axis bounds are driven by the selected range — narrowing the range zooms in
  const visibleMin = new Date(`${activeStart}-01-01T00:00:00`).getTime();
  const visibleMax = new Date(`${activeEnd}-12-31T23:59:59`).getTime();

  const rangeYears = activeEnd - activeStart + 1;
  const totalWidth = Math.max(1200, rangeYears * MIN_WIDTH_PER_YEAR * zoom);

  // Map a date to an x position based on the active range, not the full data span
  const toX = (iso) => {
    const t = new Date(iso + 'T00:00:00').getTime();
    return ((t - visibleMin) / (visibleMax - visibleMin)) * (totalWidth - PADDING * 2) + PADDING;
  };

  const allPresidential = events.filter(e => e.type === 'eo' || e.type === 'memo');
  const allScotus       = events.filter(e => e.type === 'scotus');

  // Only render events within the active range
  const presidential = allPresidential.filter(e => {
    const t = new Date(e.date + 'T00:00:00').getTime();
    return t >= visibleMin && t <= visibleMax;
  });
  const scotus = allScotus.filter(e => {
    const t = new Date(e.date + 'T00:00:00').getTime();
    return t >= visibleMin && t <= visibleMax;
  });

  const DOT_R   = 5;

  // Blurb layout constants
  const AXIS_Y      = view === 'blurbs' ? 300 : 110;
  const ABOVE_Y     = AXIS_Y - 42;
  const BELOW_Y     = AXIS_Y + 42;
  const STEP        = BLURB_H + 8; // vertical step per stagger level

  // Assign stagger levels in blurb mode
  const presidentialLeveled = view === 'blurbs' ? assignLevels(presidential, toX) : presidential;
  const scotusLeveled       = view === 'blurbs' ? assignLevels(scotus, toX)       : scotus;

  const maxBelowLevel = view === 'blurbs'
    ? Math.max(0, ...scotusLeveled.map(e => e.level ?? 0))
    : 0;

  const SVG_H = view === 'blurbs'
    ? AXIS_Y + 50 + (maxBelowLevel + 1) * STEP
    : 220;

  // Only show year ticks within the active range
  const years = [];
  for (let y = activeStart; y <= activeEnd; y++) years.push(y);

  const handleMouseEnter = (e, event, lane) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ event, lane, x: e.clientX - rect.left });
  };

  // Render a single event in dot mode
  const renderDot = (event, lane) => {
    const x = toX(event.date);
    const hovered = tooltip?.event?.id === event.id;
    const isAbove = lane === 'above';
    const dotY  = isAbove ? ABOVE_Y : BELOW_Y;
    return (
      <g key={event.id} data-testid={`timeline-event-${event.id}`} data-event-type={event.type} data-event-date={event.date}
        className={`tl-event ${event.type}${hovered ? ' hovered' : ''}`} onMouseEnter={e => handleMouseEnter(e, event, lane)}>
        {isAbove
          ? <line x1={x} y1={dotY + DOT_R} x2={x} y2={AXIS_Y} strokeWidth={1} />
          : <line x1={x} y1={AXIS_Y} x2={x} y2={dotY - DOT_R} strokeWidth={1} />}
        <circle cx={x} cy={dotY} r={hovered ? DOT_R + 2 : DOT_R} />
      </g>
    );
  };

  // Render a single event in blurb mode
  const renderBlurb = (event, lane) => {
    const x = toX(event.date);
    const level = event.level ?? 0;
    const isAbove = lane === 'above';

    // blurb y: stagger upward for above, downward for below
    const blurbY = isAbove
      ? AXIS_Y - 52 - level * STEP - BLURB_H
      : AXIS_Y + 52 + level * STEP;

    const lineEndY = isAbove ? blurbY + BLURB_H : blurbY;
    const label = event.type === 'memo' ? 'MEMO'
      : event.type === 'eo' ? `EO ${event.number || ''}`.trim()
      : 'SCOTUS';
    const title = (event.title || '').length > 28
      ? event.title.slice(0, 27) + '…'
      : (event.title || '');

    return (
      <g key={event.id} data-testid={`timeline-event-${event.id}`} data-event-type={event.type} data-event-date={event.date}
        className={`tl-event blurb ${event.type}`}>
        {/* Stem line from axis to blurb */}
        <line x1={x} y1={AXIS_Y} x2={x} y2={lineEndY} strokeWidth={1} />
        {/* Dot on axis */}
        <circle cx={x} cy={AXIS_Y} r={3} />
        {/* Blurb box */}
        <a href={event.url} target="_blank" rel="noopener noreferrer">
          <rect x={x - BLURB_W / 2} y={blurbY} width={BLURB_W} height={BLURB_H} rx={4} strokeWidth={1} />
          <text className="kind" x={x} y={blurbY + 13} textAnchor="middle" fontSize={8.5} letterSpacing="0.08em">
            {label}
          </text>
          <text className="name" x={x} y={blurbY + 27} textAnchor="middle" fontSize={9.5}>
            {title}
          </text>
        </a>
      </g>
    );
  };

  return (
    <div ref={containerRef} data-testid="horizontal-timeline" className="tl-chart">

      {/* Toolbar: view toggle + zoom */}
      <div data-testid="timeline-zoom-controls" className="tl-toolbar">
        {/* View toggle */}
        <div>
          {['dots', 'blurbs'].map(v => (
            <button key={v} type="button" aria-pressed={view === v} className={view === v ? 'btn small active' : 'btn small'} onClick={() => setView(v)}>
              {v === 'dots' ? 'Dots' : 'Blurbs'}
            </button>
          ))}
        </div>
        {/* Zoom */}
        <div>
          <button type="button" data-testid="timeline-zoom-out" className="btn small" aria-label="Zoom out" onClick={() => setZoom(z => clamp(z / 1.5, 0.5, 6))}>−</button>
          <span data-testid="timeline-zoom-level" className="tl-zoom">{Math.round(zoom * 100)}%</span>
          <button type="button" data-testid="timeline-zoom-in" className="btn small" aria-label="Zoom in" onClick={() => setZoom(z => clamp(z * 1.5, 0.5, 6))}>+</button>
        </div>
      </div>

      {/* Scrollable track */}
      <div ref={scrollRef} data-testid="timeline-scroll-container" className="tl-scroll">
        <svg data-testid="timeline-svg" width={totalWidth} height={SVG_H} onMouseLeave={() => setTooltip(null)}>

          {/* Year ticks */}
          {years.map(year => {
            const x = toX(`${year}-01-01`);
            return (
              <g key={year} className="tl-tick">
                <line x1={x} y1={AXIS_Y - 8} x2={x} y2={AXIS_Y + 8} strokeWidth={1} />
                <text x={x} y={AXIS_Y + 24} textAnchor="middle" fontSize={10.5}>{year}</text>
              </g>
            );
          })}

          {/* Axis */}
          <line className="tl-axis" x1={PADDING} y1={AXIS_Y} x2={totalWidth - PADDING} y2={AXIS_Y} strokeWidth={1.5} />

          {/* Lane labels (dots mode only) */}
          {view === 'dots' && allPresidential.length > 0 && (
            <text className="tl-lane" x={PADDING} y={ABOVE_Y - 14} fontSize={9.5} letterSpacing="0.1em">PRESIDENTIAL</text>
          )}
          {view === 'dots' && allScotus.length > 0 && (
            <text className="tl-lane" x={PADDING} y={BELOW_Y + 22} fontSize={9.5} letterSpacing="0.1em">SCOTUS</text>
          )}

          {/* Events */}
          {view === 'dots'
            ? <>
                {presidential.map(e => renderDot(e, 'above'))}
                {scotus.map(e => renderDot(e, 'below'))}
              </>
            : <>
                {presidentialLeveled.map(e => renderBlurb(e, 'above'))}
                {scotusLeveled.map(e => renderBlurb(e, 'below'))}
              </>
          }
        </svg>

        {/* Tooltip (dots mode only) */}
        {view === 'dots' && tooltip && (
          <div data-testid="timeline-tooltip" data-event-id={tooltip.event.id} className={`tl-tip ${tooltip.event.type}`} style={{
            left: Math.min(tooltip.x, totalWidth - 260),
            top: tooltip.lane === 'above' ? 12 : SVG_H - 88,
          }}>
            <div className="kind">
              {tooltip.event.type === 'memo'
                ? `Memo · ${formatDate(tooltip.event.date)}`
                : tooltip.lane === 'above'
                  ? `EO ${tooltip.event.number} · ${formatDate(tooltip.event.date)}`
                  : `SCOTUS · ${formatDate(tooltip.event.date)}`}
            </div>
            <div className="name">{tooltip.event.title}</div>
            <a href={tooltip.event.url} target="_blank" rel="noopener noreferrer">View →</a>
          </div>
        )}
      </div>
    </div>
  );
}
