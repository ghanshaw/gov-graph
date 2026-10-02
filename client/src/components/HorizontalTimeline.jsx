import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';

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

const THUMB_R = 10;

export function RangeSelector({ minYear, maxYear, rangeStart, rangeEnd, onChange }) {
  const containerRef = useRef(null);
  const dragging = useRef(null);
  const [hovering, setHovering] = useState(null);
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
        onMouseDown={e => { e.preventDefault(); dragging.current = which; }}
        onMouseEnter={() => setHovering(which)}
        onMouseLeave={() => setHovering(null)}
        style={{
          position: 'absolute',
          left: x, top: 20,
          transform: 'translate(-50%, -50%)',
          width: THUMB_R * 2, height: THUMB_R * 2,
          borderRadius: '50%',
          background: '#112040',
          border: '2px solid var(--gold)',
          boxShadow: hovering === which ? '0 0 0 4px rgba(201,168,76,0.2)' : 'none',
          cursor: 'ew-resize',
          zIndex: 3,
          transition: 'box-shadow 0.15s',
        }}
      />
      <div style={{
        position: 'absolute', left: x, top: 34,
        transform: 'translateX(-50%)',
        fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem',
        color: 'var(--gold)', letterSpacing: '0.06em',
        whiteSpace: 'nowrap', pointerEvents: 'none',
      }}>{year}</div>
    </>
  );

  return (
    <div
      ref={containerRef}
      data-testid="timeline-range-selector"
      style={{ position: 'relative', height: 56, userSelect: 'none' }}
    >
      {/* Full track */}
      <div data-testid="timeline-range-track" style={{
        position: 'absolute', top: 20,
        left: PADDING, width: trackW,
        height: 3, background: 'rgba(201,168,76,0.12)', borderRadius: 2,
      }} />

      {/* Active fill */}
      <div style={{
        position: 'absolute', top: 20,
        left: startX, width: Math.max(0, endX - startX),
        height: 3, background: 'var(--gold)', opacity: 0.65,
      }} />

      {thumb('start', startX, rangeStart)}
      {thumb('end',   endX,   rangeEnd)}
    </div>
  );
}

// ── Main Timeline ────────────────────────────────────────────────────────────

const zoomBtnStyle = {
  fontFamily: "'IBM Plex Mono', monospace", fontSize: '1rem',
  width: 28, height: 24, borderRadius: '3px',
  border: '1px solid rgba(201,168,76,0.25)', background: 'transparent',
  color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1, padding: 0,
};

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

  const maxAboveLevel = view === 'blurbs'
    ? Math.max(0, ...presidentialLeveled.map(e => e.level ?? 0))
    : 0;
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
    const isMemo = event.type === 'memo';
    const isAbove = lane === 'above';
    const base  = isAbove ? (isMemo ? 'rgba(201,168,76,0.45)' : '#c9a84c') : 'rgba(245,240,232,0.55)';
    const hover = isAbove ? (isMemo ? 'rgba(201,168,76,0.75)' : '#e8c97a') : '#ffffff';
    const lineC = isAbove ? (isMemo ? 'rgba(201,168,76,0.15)' : 'rgba(201,168,76,0.25)') : 'rgba(245,240,232,0.15)';
    const dotY  = isAbove ? ABOVE_Y : BELOW_Y;
    return (
      <g key={event.id} data-testid={`timeline-event-${event.id}`} data-event-type={event.type} data-event-date={event.date}
        style={{ cursor: 'pointer' }} onMouseEnter={e => handleMouseEnter(e, event, lane)}>
        {isAbove
          ? <line x1={x} y1={dotY + DOT_R} x2={x} y2={AXIS_Y} stroke={hovered ? base : lineC} strokeWidth={1} />
          : <line x1={x} y1={AXIS_Y} x2={x} y2={dotY - DOT_R} stroke={hovered ? hover : lineC} strokeWidth={1} />}
        <circle cx={x} cy={dotY} r={hovered ? DOT_R + 2 : DOT_R} fill={hovered ? hover : base} style={{ transition: 'r 0.1s, fill 0.1s' }} />
      </g>
    );
  };

  // Render a single event in blurb mode
  const renderBlurb = (event, lane) => {
    const x = toX(event.date);
    const level = event.level ?? 0;
    const isAbove = lane === 'above';
    const isMemo = event.type === 'memo';
    const accentColor = isAbove ? (isMemo ? 'rgba(201,168,76,0.5)' : '#c9a84c') : 'rgba(245,240,232,0.6)';
    const borderColor = isAbove ? (isMemo ? 'rgba(201,168,76,0.25)' : 'rgba(201,168,76,0.4)') : 'rgba(245,240,232,0.2)';

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
      <g key={event.id} data-testid={`timeline-event-${event.id}`} data-event-type={event.type} data-event-date={event.date}>
        {/* Stem line from axis to blurb */}
        <line x1={x} y1={isAbove ? AXIS_Y : AXIS_Y}
              x2={x} y2={lineEndY}
          stroke={accentColor} strokeWidth={1} opacity={0.35} />
        {/* Dot on axis */}
        <circle cx={x} cy={AXIS_Y} r={3} fill={accentColor} opacity={0.7} />
        {/* Blurb box */}
        <a href={event.url} target="_blank" rel="noopener noreferrer">
          <rect
            x={x - BLURB_W / 2} y={blurbY}
            width={BLURB_W} height={BLURB_H}
            rx={3}
            fill="rgba(10,22,40,0.85)"
            stroke={borderColor}
            strokeWidth={1}
            style={{ cursor: 'pointer' }}
          />
          <text x={x} y={blurbY + 12}
            textAnchor="middle"
            fontFamily="'IBM Plex Mono', monospace" fontSize={8}
            fill={accentColor} letterSpacing="0.08em">
            {label}
          </text>
          <text x={x} y={blurbY + 26}
            textAnchor="middle"
            fontFamily="'IBM Plex Sans', sans-serif" fontSize={9}
            fill="rgba(245,240,232,0.8)" fontWeight="400">
            {title}
          </text>
        </a>
      </g>
    );
  };

  return (
    <div ref={containerRef} data-testid="horizontal-timeline" style={{ position: 'relative' }}>

      {/* Toolbar: view toggle + zoom */}
      <div data-testid="timeline-zoom-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        {/* View toggle */}
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {['dots', 'blurbs'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              ...zoomBtnStyle,
              width: 'auto', padding: '0 10px',
              fontSize: '0.6rem', letterSpacing: '0.06em',
              textTransform: 'uppercase',
              background: view === v ? 'rgba(201,168,76,0.12)' : 'transparent',
              color: view === v ? 'var(--gold)' : 'var(--text-muted)',
              border: view === v ? '1px solid rgba(201,168,76,0.4)' : '1px solid rgba(201,168,76,0.15)',
            }}>{v}</button>
          ))}
        </div>
        {/* Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <button data-testid="timeline-zoom-out" onClick={() => setZoom(z => clamp(z / 1.5, 0.5, 6))} style={zoomBtnStyle}>−</button>
          <span data-testid="timeline-zoom-level" style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem',
            color: 'var(--text-muted)', padding: '4px 8px', letterSpacing: '0.05em',
          }}>{Math.round(zoom * 100)}%</span>
          <button data-testid="timeline-zoom-in" onClick={() => setZoom(z => clamp(z * 1.5, 0.5, 6))} style={zoomBtnStyle}>+</button>
        </div>
      </div>

      {/* Scrollable track */}
      <div ref={scrollRef} data-testid="timeline-scroll-container" style={{ overflowX: 'auto', overflowY: 'visible', position: 'relative', paddingBottom: '0.5rem' }}>
        <svg data-testid="timeline-svg" width={totalWidth} height={SVG_H} style={{ display: 'block', overflow: 'visible' }} onMouseLeave={() => setTooltip(null)}>

          {/* Year ticks */}
          {years.map(year => {
            const x = toX(`${year}-01-01`);
            return (
              <g key={year}>
                <line x1={x} y1={AXIS_Y - 8} x2={x} y2={AXIS_Y + 8}
                  stroke="rgba(201,168,76,0.3)" strokeWidth={1} />
                <text x={x} y={AXIS_Y + 24} textAnchor="middle"
                  fontFamily="'IBM Plex Mono', monospace" fontSize={10}
                  fill="rgba(201,168,76,0.5)" letterSpacing="0.05em">{year}</text>
              </g>
            );
          })}

          {/* Axis */}
          <line x1={PADDING} y1={AXIS_Y} x2={totalWidth - PADDING} y2={AXIS_Y}
            stroke="rgba(201,168,76,0.35)" strokeWidth={1.5} />

          {/* Lane labels (dots mode only) */}
          {view === 'dots' && allPresidential.length > 0 && (
            <text x={PADDING} y={ABOVE_Y - 14} fontFamily="'IBM Plex Mono', monospace" fontSize={9} fill="rgba(201,168,76,0.5)" letterSpacing="0.1em">PRESIDENTIAL</text>
          )}
          {view === 'dots' && allScotus.length > 0 && (
            <text x={PADDING} y={BELOW_Y + 22} fontFamily="'IBM Plex Mono', monospace" fontSize={9} fill="rgba(245,240,232,0.35)" letterSpacing="0.1em">SCOTUS</text>
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
          <div data-testid="timeline-tooltip" data-event-id={tooltip.event.id} style={{
            position: 'absolute',
            left: Math.min(tooltip.x, totalWidth - 260),
            top: tooltip.lane === 'above' ? 12 : SVG_H - 88,
            width: '240px',
            background: 'rgba(10,22,40,0.97)',
            border: `1px solid ${tooltip.lane === 'above' ? 'rgba(201,168,76,0.4)' : 'rgba(245,240,232,0.2)'}`,
            borderRadius: '4px', padding: '10px 14px',
            pointerEvents: 'none', zIndex: 10,
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          }}>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem',
              color: tooltip.lane === 'above' ? 'var(--gold)' : 'var(--text-muted)',
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px',
            }}>
              {tooltip.event.type === 'memo'
                ? `MEMO · ${formatDate(tooltip.event.date)}`
                : tooltip.lane === 'above'
                  ? `EO ${tooltip.event.number} · ${formatDate(tooltip.event.date)}`
                  : `SCOTUS · ${formatDate(tooltip.event.date)}`}
            </div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.8rem', color: 'var(--cream)', fontWeight: 400, lineHeight: 1.4, marginBottom: '8px' }}>
              {tooltip.event.title}
            </div>
            <a href={tooltip.event.url} target="_blank" rel="noopener noreferrer" style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem',
              color: tooltip.lane === 'above' ? 'var(--gold)' : 'var(--text-muted)',
              textDecoration: 'none', letterSpacing: '0.05em', pointerEvents: 'all',
            }}>View →</a>
          </div>
        )}
      </div>
    </div>
  );
}
