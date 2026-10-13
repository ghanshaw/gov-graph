import { useRef, useState, useLayoutEffect, useCallback } from 'react';

// Two handles on one track: the start and end of a range of whole steps between `min` and `max`
// (integers, e.g. months counted from year 0). Drag a handle, or focus it and use the arrow keys
// (Page Up / Down move a year's worth of steps). `format` labels a value; `gap` is the fewest steps
// the range can span. While a handle is dragged the slider moves on its own and `onChange` is
// called once, on release. `inset` is the space left of and right of the track, to line it up
// with a chart below. Styles are the timeline's (.range-* in index.css).
const PADDING = 40;
// Labels are 12px monospace: about 7.2px a character. Used to keep the end labels inside the box.
const CHAR = 7.2;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export default function RangeSlider({ min, max, start, end, onChange, format = String, gap = 1, label = 'Range', bigStep = 12, inset = [PADDING, PADDING], className }) {
  const ref = useRef(null);
  const [width, setWidth] = useState(800);
  // The range while a handle is being dragged; null otherwise.
  const [draft, setDraft] = useState(null);
  const shown = draft ?? { start, end };

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    obs.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => obs.disconnect();
  }, []);

  const [padLeft, padRight] = inset;
  const track = Math.max(1, width - padLeft - padRight);
  const span = Math.max(1, max - min);
  const toX = v => padLeft + ((v - min) / span) * track;
  // A label is centred under its handle unless that would run past either edge.
  const labelX = (v, text) => {
    const half = (text.length * CHAR) / 2;
    return clamp(toX(v), half, Math.max(half, width - half));
  };

  const next = useCallback((range, which, value) => (which === 'start'
    ? { start: clamp(value, min, range.end - gap), end: range.end }
    : { start: range.start, end: clamp(value, range.start + gap, max) }), [min, max, gap]);
  const move = (which, value) => onChange(next({ start, end }, which, value));

  const valueAt = clientX => {
    const rect = ref.current.getBoundingClientRect();
    return Math.round(min + ((clientX - rect.left - padLeft) / track) * span);
  };

  const drag = which => e => {
    e.preventDefault();
    e.currentTarget.focus();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    let range = { start, end };
    const onMove = ev => {
      range = next(range, which, valueAt(ev.clientX));
      setDraft(range);
    };
    const onUp = () => {
      setDraft(null);
      if (range.start !== start || range.end !== end) onChange(range);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  };

  const keys = (which, value) => e => {
    const by = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -bigStep, PageUp: bigStep }[e.key];
    if (by) { e.preventDefault(); move(which, value + by); }
    else if (e.key === 'Home') { e.preventDefault(); move(which, which === 'start' ? min : start + gap); }
    else if (e.key === 'End') { e.preventDefault(); move(which, which === 'start' ? end - gap : max); }
  };

  const thumb = (which, value) => (
    <>
      <div
        role="slider"
        tabIndex={0}
        aria-label={`${label} ${which}`}
        aria-valuemin={which === 'start' ? min : shown.start + gap}
        aria-valuemax={which === 'start' ? shown.end - gap : max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        className="range-thumb"
        style={{ left: toX(value), touchAction: 'none' }}
        onPointerDown={drag(which)}
        onKeyDown={keys(which, value)}
      />
      <div className="range-label" style={{ left: labelX(value, format(value)) }}>{format(value)}</div>
    </>
  );

  return (
    <div ref={ref} className={className ? `range ${className}` : 'range'}>
      <div className="range-track" style={{ left: padLeft, width: track }} />
      <div className="range-fill" style={{ left: toX(shown.start), width: Math.max(0, toX(shown.end) - toX(shown.start)) }} />
      {thumb('start', shown.start)}
      {thumb('end', shown.end)}
    </div>
  );
}
