import { Link } from 'react-router-dom';
import { COVERAGE_CHIP, COVERAGE_ORDER } from '../sources';

// A note with `code` spans (file and survey names) printed as code.
const withCode = text => text.split(/`([^`]+)`/).map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));

// Tables of the 2012 Statistical Abstract with how much of each GovGraph holds (pages/AbstractCoverage.jsx,
// SourceProgram.jsx). `vocabulary` is sourceVocabulary (coverage and shape labels); `except` is a program not to
// list again on its own page.
export default function AbstractTables({ tables, vocabulary, except }) {
  // On a program's page the column is left out when no table names another program.
  const others = tables.some(t => t.programs.some(p => p.slug !== except));
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
      <tbody>
        {tables.map(t => {
          const programs = t.programs.filter(p => p.slug !== except);
          return (
            <tr key={t.id}>
              <td className="no">
                {t.url ? <a href={t.url} title="The table as Census published it (.xls)">{t.id}</a> : t.id}
              </td>
              <td className="title">
                {t.title}
                <span className="sub">
                  {[t.categoryName, vocabulary.shapes[t.shape], t.page && `page ${t.page}`, !t.online && 'printed only'].filter(Boolean).join(' · ')}
                </span>
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
        })}
      </tbody>
    </table>
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
