import { useState } from 'react';
import { seriesGroups } from '../economy';

// Lines a pair takes up: inflows and outflows are two.
const lineCount = item => (item.compare ? 2 : 1);
const MAX_LINES = 8;

// The series shown on an Economy tab, above the chart: what is chosen, each removable, and a panel
// listing every series of the tab by group to add more. Several chosen are drawn together
// (Economy.jsx decides which share a chart). `colors` maps a chosen series to its line colour when
// more than one is shown.
export default function SeriesPicker({ tab, chosen, nameOf, onToggle, onOnly, colors, waiting = 0 }) {
  // A series by its stored name, a pair by its tab entry's.
  const labelOf = item => item.label ?? nameOf(item.value);
  const [open, setOpen] = useState(false);
  const values = new Set(chosen.map(c => c.value));
  const used = chosen.reduce((n, c) => n + lineCount(c), 0);
  const multi = chosen.length > 1;
  const groups = seriesGroups(tab.series);
  const groupOf = item => groups.find(g => g.options.includes(item));

  return (
    <div className="series-picker" data-testid="series-picker">
      <div className="series-chosen">
        <span className="series-chosen-label">Showing</span>
        {chosen.map(item => (
          <span key={item.value} className="series-chip" style={multi ? { '--c': colors.get(item.value) } : undefined}>
            {multi && <i className="swatch line" />}
            {labelOf(item)}
            {groupOf(item)?.heading && <small>{groupOf(item).heading}</small>}
            {multi && (
              <button type="button" aria-label={`Remove ${labelOf(item)}`} onClick={() => onToggle(item.value)}>×</button>
            )}
          </span>
        ))}
        <button type="button" className={open ? 'btn small active' : 'btn small'} aria-expanded={open}
          data-testid="series-picker-toggle" onClick={() => setOpen(!open)}>
          {open ? 'Done' : 'Add or change series'}
        </button>
      </div>
      {open && (
        <div className="series-menu" data-testid="series-menu">
          <p className="series-menu-note">
            Tick several to compare them. Series measured alike (dollars a month, percent) share a chart;
            others get their own, stacked with the same dates. Up to {MAX_LINES} lines.
          </p>
          <div className="series-groups">
            {groups.map(({ group, heading, source, options }) => (
              <div key={group ?? 'all'} className="series-group" role="group" aria-label={heading ?? tab.label}>
                {heading && <h4>{heading}{source && <small>{source}</small>}</h4>}
                {options.map(item => {
                  const on = values.has(item.value);
                  const full = !on && used + lineCount(item) > MAX_LINES;
                  return (
                    <div key={item.value} className="series-option">
                      <button type="button" role="checkbox" aria-checked={on} disabled={full}
                        className={on ? 'opt check on' : 'opt check'}
                        title={full ? `At most ${MAX_LINES} lines` : undefined}
                        onClick={() => onToggle(item.value)}>
                        <b />{labelOf(item)}
                      </button>
                      <button type="button" className="series-only" onClick={() => onOnly(item.value)}
                        aria-label={`Show only ${labelOf(item)}`}>only</button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {waiting > 0 && (
            <p className="series-menu-note">
              {waiting === 1 ? 'One more series appears once its source files are loaded.' : `${waiting} more series appear once their source files are loaded.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
