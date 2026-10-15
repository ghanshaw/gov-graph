import { Link } from 'react-router-dom';
import { COVERAGE_CHIP, COVERAGE_ORDER } from '../sources';

// A note with `code` spans (file and survey names) printed as code.
const withCode = text => text.split(/`([^`]+)`/).map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));

const EVERY = { annual: 'yearly', 'fiscal-year': 'fiscal years', quarterly: 'quarterly', monthly: 'monthly', weekly: 'weekly', daily: 'daily', 'four-week-average': '4-week averages' };

// What a table names as loaded, with the frequency, years and places of each; series that share them are named
// together: "Births, Deaths (yearly, 2011–2025; nation, 50 states, DC and Puerto Rico)".
function loadedLabel(series) {
  const detail = s => {
    if (!s.found) return 'not in the database';
    const years = s.firstDate && `${s.firstDate.slice(0, 4)}–${s.lastDate.slice(0, 4)}`;
    const where = s.count ? `${s.count} series` : s.groups ? `${s.groups} groups` : s.placesLabel ? `${s.national ? 'nation, ' : ''}${s.placesLabel}` : null;
    return `${[EVERY[s.frequency] ?? s.frequency, years].filter(Boolean).join(', ')}${where ? `; ${where}` : ''}`;
  };
  const groups = [];
  for (const s of series) {
    const d = detail(s);
    const last = groups.at(-1);
    if (last?.detail === d) last.names.push(s.name);
    else groups.push({ detail: d, names: [s.name] });
  }
  return groups.map(g => `${g.names.join(', ')} (${g.detail})`).join(' · ');
}

/** Tables grouped by subsection, each group where its first table falls in book order: [[category, tables]]. */
function bySubsection(tables) {
  const groups = new Map();
  for (const t of tables) groups.set(t.category, [...(groups.get(t.category) ?? []), t]);
  return [...groups];
}

// Tables of the 2012 Statistical Abstract with how much of each GovGraph holds (pages/AbstractCoverage.jsx,
// SourceProgram.jsx), under a heading row for each subsection, as the Abstract groups them. `vocabulary` is
// sourceVocabulary (coverage and shape labels); `except` is a program not to list again on its own page, where the
// tables come from several sections and the heading names the section too.
export default function AbstractTables({ tables, vocabulary, except }) {
  // On a program's page the column is left out when no table names another program.
  const others = tables.some(t => t.programs.some(p => p.slug !== except));
  const columns = others ? 4 : 3;
  return (
    <table className="records coverage-tables">
      <thead>
        <tr>
          <th>Table</th>
          <th>Title</th>
          {others && <th className="wide-only">{except ? 'Also cites' : 'Program'}</th>}
          <th>Coverage</th>
        </tr>
      </thead>
      {bySubsection(tables).map(([category, list]) => (
        <tbody key={category}>
          <tr className="subsection-row">
            <th colSpan={columns} scope="colgroup">
              {except && <span className="section-name">{list[0].sectionName} › </span>}
              {list[0].categoryName ?? category}
              <small>{coverageCounts(list).map(([c, n]) => `${n} ${vocabulary.coverage[c].toLowerCase()}`).join(' · ')}</small>
            </th>
          </tr>
          {list.map(t => <TableRow key={t.id} t={t} vocabulary={vocabulary} except={except} others={others} />)}
        </tbody>
      ))}
    </table>
  );
}

function TableRow({ t, vocabulary, except, others }) {
  const programs = t.programs.filter(p => p.slug !== except);
  return (
    <tr>
      <td className="no">
        {t.url ? <a href={t.url} title="The table as Census published it (.xls)">{t.id}</a> : t.id}
      </td>
      <td className="title">
        {t.title}
        <span className="sub">
          {[vocabulary.shapes[t.shape], t.page && `page ${t.page}`, !t.online && 'printed only'].filter(Boolean).join(' · ')}
        </span>
        {t.series?.length > 0 && <span className="sub loaded">Loaded: {loadedLabel(t.series)}</span>}
        {t.note && <span className="sub">{withCode(t.note)}</span>}
        {programs.length > 0 && (
          <span className="sub narrow-only">{programs.map(p => p.name).join('; ')}</span>
        )}
      </td>
      {others && (
        <td className="meta wide-only">
          {programs.map((p, i) => (
            <span key={p.slug}>{i > 0 && '; '}<Link to={`/sources/${p.slug}`}>{p.name}</Link></span>
          ))}
        </td>
      )}
      <td className="nowrap">
        <span className={COVERAGE_CHIP[t.coverage] ?? 'chip'}>{vocabulary.coverage[t.coverage] ?? 'Not mapped'}</span>
        {t.inHand && <span className="sub in-hand">File in hand</span>}
      </td>
    </tr>
  );
}

/** Counts by coverage, in COVERAGE_ORDER: [[coverage, n]] for those present. */
export function coverageCounts(tables) {
  const n = {};
  for (const t of tables) n[t.coverage] = (n[t.coverage] ?? 0) + 1;
  return COVERAGE_ORDER.filter(c => n[c]).map(c => [c, n[c]]);
}

// A bar split by coverage: how much of a section (or of everything) GovGraph holds.
export function CoverageBar({ tables, vocabulary }) {
  const counts = coverageCounts(tables);
  return (
    <div className="coverage-bar" role="img" aria-label={counts.map(([c, n]) => `${vocabulary.coverage[c]} ${n}`).join(', ')}>
      {counts.map(([c, n]) => <i key={c} className={`cov-${c}`} style={{ flexGrow: n }} title={`${vocabulary.coverage[c]}: ${n}`} />)}
    </div>
  );
}
