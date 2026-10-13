import { useState } from 'react';
import { scaleOf, scaleName, laneScales, laneVerdict } from '../lanes';
import { FrequencyBadge } from './DatasetSearch';

// The panel beside the timeline: the lanes, top to bottom, each a chart, with the series on it; then
// the context (events, presidencies, periods), each with how many fall in the years shown.
//
// A series can be hidden (kept, struck through, its colour kept), removed, or dragged onto another
// lane: it joins a lane on its scale, takes a second scale on the right of a lane with one, and is
// refused by a lane that has two. Dropped on "New lane", it is drawn on its own.

/** Under a series, only when it does not cover the years shown: "starts 2015", "ends 2022". */
function spanNote(series, startYear, endYear) {
  const first = Number(series.firstDate?.slice(0, 4)), last = Number(series.lastDate?.slice(0, 4));
  const late = first > startYear, early = last < endYear - 1;
  return late && early ? `only ${first}–${last}` : late ? `starts ${first}` : early ? `ends ${last}` : '';
}

/**
 * lanes: [{ id, items: [{ slug, on, axis }] }]. `colorOf(slug)`: the series' colour. `onLanes(next)`:
 * the lanes after a change. `context`: [{ key, label, swatch, count, on }]; `onContext(key)`.
 */
export default function LanePanel({ lanes, bySlug, colorOf, startYear, endYear, onLanes, onRemove, context, onContext, newLaneId }) {
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null); // { lane, verdict }

  const without = (ls, slug) => ls.map(l => ({ ...l, items: l.items.filter(i => i.slug !== slug) })).filter(l => l.items.length);
  const drop = target => {
    const item = lanes.flatMap(l => l.items).find(i => i.slug === dragging);
    setOver(null);
    setDragging(null);
    if (!item) return;
    if (target === 'new') {
      onLanes([...without(lanes, item.slug), { id: newLaneId(), items: [{ ...item, axis: 'left' }] }]);
      return;
    }
    const lane = lanes.find(l => l.id === target);
    if (lane.items.some(i => i.slug === item.slug)) return;
    const verdict = laneVerdict(lane, item.slug, bySlug);
    if (verdict === 'no') return;
    const scale = scaleOf(bySlug.get(item.slug));
    const sameScale = lane.items.find(i => scaleOf(bySlug.get(i.slug)) === scale);
    const axis = verdict === 'axis' ? (lane.items.some(i => i.axis === 'right') ? 'left' : 'right') : sameScale?.axis ?? 'left';
    // The target keeps its other series, so it is never the lane emptied by the move.
    onLanes(without(lanes, item.slug).map(l => (l.id === target ? { ...l, items: [...l.items, { ...item, axis }] } : l)));
  };
  const update = (laneId, fn) => onLanes(lanes.map(l => (l.id === laneId ? fn(l) : l)));
  const move = (index, by) => {
    const next = [...lanes];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onLanes(next);
  };

  return (
    <aside className="lane-panel" data-testid="lane-panel">
      <section className="lane-section">
        <h4>Lanes, top to bottom</h4>
        {!lanes.length && <p className="lane-empty">No data on the timeline yet. Search above, or browse the datasets, and tick what you want to see.</p>}
        {lanes.map((lane, index) => {
          const scales = laneScales(lane, bySlug);
          const sideOf = scale => (lane.items.find(i => scaleOf(bySlug.get(i.slug)) === scale)?.axis === 'right' ? 'right' : 'left');
          const v = over?.lane === lane.id ? over.verdict : null;
          return (
            <div key={lane.id} className={v ? `lane drop-${v}` : 'lane'} data-testid={`lane-${index + 1}`}
              onDragOver={e => {
                if (!dragging) return;
                e.preventDefault();
                const verdict = lane.items.some(i => i.slug === dragging) ? 'ok' : laneVerdict(lane, dragging, bySlug);
                if (over?.lane !== lane.id || over.verdict !== verdict) setOver({ lane: lane.id, verdict });
              }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); }}
              onDrop={e => { e.preventDefault(); drop(lane.id); }}>
              <div className="lane-head">
                <b>Lane {index + 1}</b>
                <span className="scales">{scales.length > 1 ? scales.map(s => `${scaleName(s)} (${sideOf(s)})`).join(' · ') : scaleName(scales[0])}</span>
                <span className="move">
                  <button type="button" disabled={!index} onClick={() => move(index, -1)} aria-label={`Move lane ${index + 1} up`}>↑</button>
                  <button type="button" disabled={index === lanes.length - 1} onClick={() => move(index, 1)} aria-label={`Move lane ${index + 1} down`}>↓</button>
                </span>
              </div>
              {v === 'axis' && <p className="drop-note">Adds a second scale on the right ({scaleName(scaleOf(bySlug.get(dragging))).toLowerCase()})</p>}
              {v === 'no' && <p className="drop-note no">This lane already has two scales</p>}
              {lane.items.map(item => {
                const s = bySlug.get(item.slug);
                if (!s) return null;
                const note = spanNote(s, startYear, endYear);
                return (
                  <div key={item.slug} className={item.on ? 'layer' : 'layer off'} draggable data-testid={`layer-${item.slug}`}
                    style={{ '--c': colorOf(item.slug) }} title={`${s.name} · drag to another lane`}
                    onDragStart={e => { setDragging(item.slug); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', item.slug); }}
                    onDragEnd={() => { setDragging(null); setOver(null); }}>
                    <span className="grip" aria-hidden="true">⋮⋮</span>
                    <button type="button" className="eye" aria-pressed={item.on} aria-label={item.on ? `Hide ${s.name}` : `Show ${s.name}`}
                      onClick={() => update(lane.id, l => ({ ...l, items: l.items.map(i => (i.slug === item.slug ? { ...i, on: !i.on } : i)) }))}>
                      {item.on ? '◉' : '○'}
                    </button>
                    <i className="sw" />
                    <span className="name">{s.name}{note && <small>{note}</small>}</span>
                    <span className="tail">
                      <FrequencyBadge frequency={s.frequency} />
                      {scales.length > 1 && (
                        <button type="button" className="axis" title="Swap the two scales" aria-label="Swap the two scales"
                          onClick={() => update(lane.id, l => ({ ...l, items: l.items.map(i => ({ ...i, axis: i.axis === 'right' ? 'left' : 'right' })) }))}>
                          {item.axis === 'right' ? 'R' : 'L'}
                        </button>
                      )}
                      <button type="button" className="x" aria-label={`Remove ${s.name}`} onClick={() => onRemove(item.slug)}>×</button>
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
        {lanes.length > 0 && (
          <div className={over?.lane === 'new' ? 'new-lane drop-ok' : 'new-lane'} data-testid="new-lane"
            onDragOver={e => { if (dragging) { e.preventDefault(); if (over?.lane !== 'new') setOver({ lane: 'new', verdict: 'ok' }); } }}
            onDragLeave={() => setOver(null)} onDrop={e => { e.preventDefault(); drop('new'); }}>
            + New lane: drop a dataset here
          </div>
        )}
      </section>

      <section className="lane-section">
        <h4>Context <small>in the years shown</small></h4>
        {context.map(c => (
          <label key={c.key} className="context-row" data-testid={`context-${c.key}`}>
            <input type="checkbox" checked={c.on} onChange={() => onContext(c.key)} />
            <i className={`sw ${c.swatch}`} />
            <span>{c.label}</span>
            <small>{c.count}</small>
          </label>
        ))}
      </section>
    </aside>
  );
}
