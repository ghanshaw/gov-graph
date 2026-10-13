import { useState, useEffect, useMemo, useRef } from 'react';
import { ECONOMY_TABS, seriesGroups } from '../economy';
import { FREQUENCY_CODES, sourceShort } from '../lanes';
import DatasetBuilder from './DatasetBuilder';

// The search field across the top of the timeline, and under it the catalogue of every economic
// series, by subject (the Economy tabs) and meaning (their groups). Search matches a series' name,
// its group and description, and the words people use for its subject ("tax the rich" finds Tax
// rates). Ticking a row puts the series in a lane; the row says which before it is ticked. Build mode
// (DatasetBuilder) reaches the same series by their dimensions instead.

const FILTERS = [['D', 'Daily'], ['W', 'Weekly'], ['M', 'Monthly'], ['Q', 'Quarterly'], ['Y', 'Yearly'], ['FY', 'Fiscal year']];
const normal = text => text.toLowerCase().replace(/[’']/g, '\'');
const words = q => normal(q).split(/\s+/).filter(Boolean);
const yearOf = iso => iso?.slice(0, 4) ?? '';
const firstSentence = text => (text ?? '').split(/\.\s/)[0];

/** A frequency badge: one or two letters, coloured from fine to coarse. */
export function FrequencyBadge({ frequency }) {
  const [code, name] = FREQUENCY_CODES[frequency] ?? ['?', frequency];
  return <abbr className={`freq-badge f-${code === '·' ? 'irr' : code}`} title={name}>{code}</abbr>;
}

// Every row of the catalogue: [{ subject, group, heading, item, slugs, name, series }]. A pair is one row.
function catalogRows(bySlug) {
  return ECONOMY_TABS.flatMap(tab => {
    const groups = seriesGroups(tab.series).map(g => ({ ...g, items: g.options }));
    // The published breakdowns of a series (unemployment by group) follow the tab's own series.
    for (const of of tab.search?.breakdowns ?? []) {
      const items = [...bySlug.values()].filter(s => s.slug.startsWith(`${of}--`)).map(s => ({ value: s.slug }));
      if (items.length) groups.push({ group: `${bySlug.get(of)?.name ?? of}, by group (BLS)`, heading: `${bySlug.get(of)?.name ?? of}, by group`, source: 'BLS', items });
    }
    return groups.flatMap(g => g.items.map(item => {
      const slugs = item.compare ? [item.compare.inflow, item.compare.outflow] : [item.value];
      const series = bySlug.get(slugs[0]);
      return { subject: tab, heading: g.heading, groupKey: `${tab.slug}|${g.group ?? ''}`, item, slugs, series, name: item.label ?? series?.name ?? item.value };
    })).filter(r => r.series);
  });
}

/**
 * `bySlug`: every series stored (useSeriesList). `isOn(slugs)`: whether a choice is on the timeline.
 * `landing(slugs)`: where it would go ("→ lane 2", "→ new lane"). `onToggle(row)`: add or remove it.
 * `onSwap(remove, add)`: take some series off and put others on in one change (Build mode).
 */
export default function DatasetSearch({ bySlug, isOn, landing, onToggle, onSwap }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [freqs, setFreqs] = useState(new Set());
  const [subject, setSubject] = useState(null);
  const [mode, setMode] = useState('browse');
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const rows = useMemo(() => catalogRows(bySlug), [bySlug]);

  useEffect(() => {
    const onKey = e => {
      if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName ?? '')) { e.preventDefault(); inputRef.current?.focus(); }
      if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const q = query.trim();
  const matches = row => {
    if (!q) return true;
    const nq = normal(q);
    const subjectWords = [normal(row.subject.label), ...(row.subject.search?.words ?? [])];
    // A subject's word inside the search ("tax the rich" holds "the rich") counts only when it is not a short word like "tax".
    if (subjectWords.some(w => w.includes(nq) || (w.length > 4 && nq.includes(w)))) return true;
    const hay = normal(`${row.name} ${row.heading ?? ''} ${row.series.description ?? ''} ${sourceShort(row.series.source)}`);
    return words(q).every(w => hay.includes(w));
  };
  const freqCode = row => { const c = FREQUENCY_CODES[row.series.frequency]?.[0]; return c === '4W' ? 'W' : c; };
  const shown = rows.filter(r => matches(r) && (!freqs.size || freqs.has(freqCode(r))));
  const subjects = ECONOMY_TABS.filter(t => shown.some(r => r.subject === t));
  const inUse = rows.filter(r => isOn(r.slugs));
  const onCountOf = tab => rows.filter(r => r.subject === tab && isOn(r.slugs)).length;

  const highlight = text => {
    const ws = words(q).filter(w => w.length > 1);
    if (!ws.length) return text;
    const re = new RegExp(`(${ws.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig');
    return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
  };
  const goTo = tab => {
    setSubject(tab?.slug ?? null);
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = tab ? (list.querySelector(`[data-subject="${tab.slug}"]`)?.offsetTop ?? 0) - list.offsetTop : 0;
  };
  const toggleFreq = code => setFreqs(prev => {
    const next = new Set(prev);
    if (next.has(code)) next.delete(code); else next.add(code);
    return next;
  });
  const total = rows.length;

  return (
    <div className="dataset-search" data-testid="dataset-search">
      <label className="finder-field">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input ref={inputRef} value={query} autoComplete="off" data-testid="dataset-search-input" aria-label="Search datasets"
          placeholder="Search datasets: unemployment, taxes, gas prices, the Fed, tariffs…"
          onChange={e => { setQuery(e.target.value); setOpen(true); setMode('browse'); setSubject(null); if (listRef.current) listRef.current.scrollTop = 0; }}
          onFocus={() => setOpen(true)} />
        <kbd>/</kbd>
        <button type="button" className={open ? 'browse on' : 'browse'} data-testid="dataset-browse" onClick={() => setOpen(!open)}>
          {open ? 'Done' : `Browse all ${total} datasets`}
        </button>
      </label>

      {open && (
        <section className="catalog" data-testid="dataset-catalog">
          <div className="catalog-filters">
            <span className="modes" role="tablist" aria-label="How to find datasets">
              {[['browse', 'Browse'], ['build', 'Build']].map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={mode === key} className={mode === key ? 'on' : undefined}
                  data-testid={`dataset-mode-${key}`} onClick={() => setMode(key)}>{label}</button>
              ))}
            </span>
            {inUse.length > 0 && (
              // What is on the timeline: a count beside the modes, listed on hover or focus, each with its ×.
              <span className="in-use-menu" data-testid="dataset-in-use">
                <button type="button" className="in-use-toggle" aria-haspopup="true">In use <b>{inUse.length}</b></button>
                <span className="in-use-pop" role="menu">
                  {inUse.map(r => (
                    <button key={r.item.value} type="button" role="menuitem" title={`Remove ${r.name} from the timeline`} onClick={() => onToggle(r)}>
                      <span>{r.name}</span><span className="x" aria-hidden="true">×</span>
                    </button>
                  ))}
                </span>
              </span>
            )}
            {mode === 'browse' && <span className="f">How often {FILTERS.map(([code, name]) => (
              <button key={code} type="button" className={freqs.has(code) ? 'pill on' : 'pill'} aria-pressed={freqs.has(code)} onClick={() => toggleFreq(code)}>{name}</button>
            ))}</span>}
            <span className="count">
              {mode === 'build' ? `${total} datasets` : shown.length === total ? `${total} datasets` : `${shown.length} of ${total} datasets`}
              {mode === 'browse' && q && ` match “${q}”`}
            </span>
          </div>
          {mode === 'build' ? <DatasetBuilder bySlug={bySlug} isOn={isOn} landing={landing} onToggle={onToggle} onSwap={onSwap} /> : (
          <div className="catalog-body">
            <nav className="catalog-nav" aria-label="Subjects">
              <button type="button" className={!subject ? 'on' : undefined} onClick={() => goTo(null)}><i>All subjects</i><span>{shown.length}</span></button>
              {subjects.map(t => {
                const n = onCountOf(t);
                return (
                  <button key={t.slug} type="button" className={subject === t.slug ? 'on' : undefined} onClick={() => goTo(t)}>
                    <i>{t.label}</i>{n > 0 && <b>{n} on</b>}<span>{shown.filter(r => r.subject === t).length}</span>
                  </button>
                );
              })}
            </nav>
            <div className="catalog-list" ref={listRef}>
              {!subjects.length && <p className="catalog-empty">No dataset matches “{q}”. Try a word from the news: jobs, prices, taxes, the Fed.</p>}
              {subjects.map(t => {
                const own = shown.filter(r => r.subject === t);
                const groups = [...new Set(own.map(r => r.groupKey))];
                return (
                  <section key={t.slug} className="catalog-subject" data-subject={t.slug}>
                    <h3>{t.label}</h3>
                    {t.search?.heard && <p className="heard">In the news: {t.search.heard}</p>}
                    {groups.map(key => {
                      const groupRows = own.filter(r => r.groupKey === key);
                      return (
                        <div key={key}>
                          {groupRows[0].heading && <h4>{groupRows[0].heading}</h4>}
                          {groupRows.map(r => {
                            const on = isOn(r.slugs);
                            const to = on ? null : landing(r.slugs);
                            return (
                              <button key={r.item.value} type="button" role="checkbox" aria-checked={on} className={on ? 'dataset on' : 'dataset'}
                                data-testid={`dataset-${r.item.value}`} onClick={() => onToggle(r)}>
                                <span className="tick">{on ? '✓' : ''}</span>
                                <span className="name">{highlight(r.name)}{r.item.value === t.search?.headline && <em>the one in the news</em>}</span>
                                <span className="why">{highlight(r.item.compare ? `Both drawn on one chart: ${r.slugs.map(s => bySlug.get(s)?.name).join(' and ')}.` : firstSentence(r.series.description))}</span>
                                <span className="meta">
                                  <FrequencyBadge frequency={r.series.frequency} /> {yearOf(r.series.firstDate)}–{yearOf(r.series.lastDate)} · {sourceShort(r.series.source)}
                                  {to && <span className={to.isNew ? 'lands new' : 'lands'}>{to.text}</span>}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                    {!q && !freqs.size && (t.search?.missing ?? []).map(m => <p key={m} className="catalog-missing"><b>Not here yet.</b> {m}</p>)}
                  </section>
                );
              })}
            </div>
          </div>
          )}
        </section>
      )}
    </div>
  );
}
