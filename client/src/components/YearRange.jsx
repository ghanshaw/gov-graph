import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { PADDING } from './TimelineChart';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// A year typed in a box: applied on Enter or leaving the box, ignored unless it is a year. Keyed by
// its value where used, so a new value from elsewhere starts it afresh.
function YearInput({ value, label, onCommit }) {
  const [text, setText] = useState(String(value));
  const commit = () => {
    const y = Number.parseInt(text, 10);
    if (Number.isFinite(y) && y !== value) onCommit(y); else setText(String(value));
  };
  return (
    <input className="year-input" inputMode="numeric" maxLength={4} aria-label={label} value={text}
      onChange={e => setText(e.target.value)} onBlur={commit} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
  );
}

/**
 * The years shown on the timeline: typed, picked from a preset, or dragged on a track lined up with
 * the chart below (its ends inset by the chart's PADDING). `presets`: [{ label, value, start, end }];
 * `preset` is the one in force (null once a year is typed or dragged).
 */
export default function YearRange({ minYear, maxYear, start, end, presets, preset, onPreset, onChange }) {
  const ref = useRef(null);
  const dragging = useRef(null);
  const [width, setWidth] = useState(800);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    obs.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => obs.disconnect();
  }, []);
  const track = Math.max(1, width - PADDING * 2);
  const span = Math.max(1, maxYear - minYear);
  const toX = y => PADDING + ((y - minYear) / span) * track;
  const yearAt = useCallback(clientX => {
    const rect = ref.current?.getBoundingClientRect();
    return rect ? Math.round(minYear + ((clientX - rect.left - PADDING) / track) * span) : minYear;
  }, [minYear, span, track]);

  const set = (a, b) => {
    const s = clamp(a, minYear, maxYear - 1);
    onChange({ start: s, end: clamp(b, s + 1, maxYear) });
  };
  useEffect(() => {
    const onMove = e => {
      if (!dragging.current) return;
      const y = clamp(yearAt(e.clientX), minYear, maxYear);
      if (dragging.current === 'start') onChange({ start: clamp(y, minYear, end - 1), end });
      else onChange({ start, end: clamp(y, start + 1, maxYear) });
    };
    const onUp = () => { dragging.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [minYear, maxYear, start, end, onChange, yearAt]);

  const keys = which => e => {
    const by = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 }[e.key];
    if (!by) return;
    e.preventDefault();
    if (which === 'start') set(start + by, end); else set(start, end + by);
  };
  const thumb = (which, year) => (
    <div data-testid={`timeline-range-handle-${which}`} className="range-thumb" role="slider" tabIndex={0}
      aria-label={which === 'start' ? 'From year' : 'To year'} aria-valuemin={minYear} aria-valuemax={maxYear} aria-valuenow={year}
      onMouseDown={e => { e.preventDefault(); dragging.current = which; }} onKeyDown={keys(which)} style={{ left: toX(year) }} />
  );
  const ticks = [];
  const tickStep = span > 60 ? 20 : span > 24 ? 10 : 5;
  for (let y = Math.ceil(minYear / tickStep) * tickStep; y <= maxYear; y += tickStep) ticks.push(y);

  return (
    <div className="year-range" data-testid="timeline-year-range">
      <div className="year-range-head">
        <span className="year-range-label">Years</span>
        <YearInput key={`s${start}`} value={start} label="From year" onCommit={y => set(y, end)} />
        <span className="year-dash">–</span>
        <YearInput key={`e${end}`} value={end} label="To year" onCommit={y => set(start, y)} />
        <span className="year-presets">
          {presets.map(p => (
            <button key={p.value} type="button" className={preset === p.value ? 'pill on' : 'pill'} aria-pressed={preset === p.value} onClick={() => onPreset(p.value)}>{p.label}</button>
          ))}
        </span>
      </div>
      <div ref={ref} data-testid="timeline-range-selector" className="range">
        <div data-testid="timeline-range-track" className="range-track" style={{ left: PADDING, width: track }} />
        <div className="range-fill" style={{ left: toX(start), width: Math.max(0, toX(end) - toX(start)) }} />
        {ticks.map(y => <span key={y} className="range-tick" style={{ left: toX(y) }}>{y}</span>)}
        {thumb('start', start)}
        {thumb('end', end)}
      </div>
    </div>
  );
}
