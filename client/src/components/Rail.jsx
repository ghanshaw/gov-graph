// Pieces of the left rail (see .rail in index.css).

export function RailGroup({ title, children }) {
  return (
    <div className="group">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

// One choice out of a few. options: [{ label, value }]
export function RadioOptions({ label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label}>
      {options.map(option => {
        const on = option.value === value;
        return (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={on}
            className={on ? 'opt on' : 'opt'}
            onClick={() => onChange(option.value)}
          >
            <b />{option.label}
          </button>
        );
      })}
    </div>
  );
}

// A switch that is on or off by itself.
export function CheckOption({ label, checked, onChange }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className={checked ? 'opt check on' : 'opt check'}
      onClick={() => onChange(!checked)}
    >
      <b />{label}
    </button>
  );
}

// Years with a bar and a count each, and "All" above them. `counts` maps year → count;
// without it (not loaded, or not available for this list) the rows show the year alone.
// value is the selected year, or null for all.
export function YearFacet({ years, counts, total, value, onChange }) {
  const max = counts ? Math.max(1, ...years.map(y => counts[y] ?? 0)) : null;
  const row = (key, label, on, width, count) => (
    <button key={key} type="button" aria-pressed={on} className={on ? 'year on' : 'year'} onClick={() => onChange(key === 'all' ? null : key)}>
      <span>{label}</span>
      <i style={{ width: width == null ? 0 : `${width}%` }} />
      <span className="count">{count != null ? count.toLocaleString() : ''}</span>
    </button>
  );
  return (
    <>
      {row('all', 'All', value == null, counts || total != null ? 100 : null, total)}
      {years.map(y => row(y, y, value === y, counts ? Math.round(((counts[y] ?? 0) / max) * 100) : null, counts ? counts[y] ?? 0 : null))}
    </>
  );
}

export function Fact({ label, children }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <b>{children}</b>
    </div>
  );
}
