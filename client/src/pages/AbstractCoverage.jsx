import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_ABSTRACT_COVERAGE } from '../queries';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import { RailGroup, RadioOptions, Fact } from '../components/Rail';
import Loading from '../components/Loading';
import SearchBox from '../components/SearchBox';
import AbstractTables, { CoverageBar, coverageCounts } from '../components/AbstractTables';
import { COVERAGE_ORDER } from '../sources';

// The 2012 Statistical Abstract table by table, against what GovGraph holds: each table's programs (the publications
// its source note names) and its coverage (seed/data/statistical-abstract-coverage.json). Section, coverage and shape
// are kept in the URL (?section=14&coverage=wanted&shape=by-place); the search is not.
export default function AbstractCoverage() {
  const { data, loading, error } = useQuery(GET_ABSTRACT_COVERAGE);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const filters = { section: params.get('section'), coverage: params.get('coverage'), shape: params.get('shape') };
  const set = key => value => setParams(p => {
    const next = new URLSearchParams(p);
    if (value == null) next.delete(key);
    else next.set(key, value);
    return next;
  }, { replace: true });

  const vocabulary = data?.sourceVocabulary;
  const sections = data?.abstractCoverage.sections ?? [];
  const all = data?.abstractCoverage.tables ?? [];

  // Every typed word must be in the table's number, title, subsection, note or a program's name.
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const text = t => [t.id, t.title, t.categoryName, t.note, ...t.programs.map(p => p.name)].filter(Boolean).join(' ').toLowerCase();
  const tests = {
    section: v => t => String(t.section) === v,
    coverage: v => t => t.coverage === v,
    shape: v => t => t.shape === v,
  };
  const passes = (t, except) => words.every(w => text(t).includes(w))
    && Object.entries(filters).every(([key, v]) => key === except || v == null || tests[key](v)(t));
  const shown = all.filter(t => passes(t));

  // A filter's options with the number each would show, given the other filters.
  const options = (key, entries) => {
    const rest = all.filter(t => passes(t, key));
    return [{ value: null, label: `All (${rest.length})` },
      ...entries.map(([value, label]) => ({ value, label: `${label} (${rest.filter(tests[key](value)).length})` }))
        .filter(o => !o.label.endsWith('(0)') || filters[key] === o.value)];
  };

  const rail = vocabulary && (
    <>
      <RailGroup title="Held">
        <Fact label="Tables">{all.length.toLocaleString()}</Fact>
        {coverageCounts(all).map(([c, n]) => <Fact key={c} label={vocabulary.coverage[c]}>{n.toLocaleString()}</Fact>)}
        <Fact label="File in hand">{all.filter(t => t.inHand).length}</Fact>
      </RailGroup>
      <RailGroup title="Coverage">
        <RadioOptions label="Coverage" options={options('coverage', COVERAGE_ORDER.map(c => [c, vocabulary.coverage[c]]))}
          value={filters.coverage} onChange={set('coverage')} />
      </RailGroup>
      <RailGroup title="Shape">
        <RadioOptions label="Shape" options={options('shape', Object.entries(vocabulary.shapes))} value={filters.shape} onChange={set('shape')} />
      </RailGroup>
      <RailGroup title="Section">
        <select className="rail-select" aria-label="Section" value={filters.section ?? ''} onChange={e => set('section')(e.target.value || null)}>
          {options('section', sections.map(s => [String(s.number), `${s.number}. ${s.name}`]))
            .map(o => <option key={o.label} value={o.value ?? ''}>{o.label}</option>)}
        </select>
      </RailGroup>
    </>
  );

  const groups = sections.map(s => [s, shown.filter(t => t.section === s.number)]).filter(([, list]) => list.length);

  return (
    <PageLayout rail={rail}>
      <Crumbs items={[{ label: 'Sources', to: '/sources' }, { label: 'Statistical Abstract coverage' }]} />
      <div className="page-head">
        <h1 className="page-title">
          Statistical Abstract Coverage <small>{shown.length === all.length ? `${all.length.toLocaleString()} tables` : `${shown.length.toLocaleString()} of ${all.length.toLocaleString()}`}</small>
        </h1>
        <SearchBox value={search} onChange={setSearch} placeholder="Table, title, program…" />
      </div>
      <p className="lede">
        Every table of the 2012 Statistical Abstract of the United States, with the programs its source note names and how much of
        them GovGraph holds. The Abstract is the list of what to collect: each publisher&rsquo;s current, full data, not the
        Abstract&rsquo;s 2011 numbers. <Link to="/sources" className="inline-link">All sources</Link>
      </p>
      {vocabulary && <CoverageBar tables={shown} vocabulary={vocabulary} />}

      {loading && <Loading />}
      {error && <div className="error">Failed to load: {error.message}</div>}

      {vocabulary && groups.map(([s, list]) => (
        <section key={s.id} id={s.id} className="page-section">
          <h2 className="section-title">
            {s.number}. {s.name} <small>{coverageCounts(list).map(([c, n]) => `${n} ${vocabulary.coverage[c].toLowerCase()}`).join(' · ')}</small>
          </h2>
          <AbstractTables tables={list} vocabulary={vocabulary} />
        </section>
      ))}
      {!loading && all.length > 0 && shown.length === 0 && (
        <div className="state">Nothing matches {words.length ? `“${search.trim()}”` : 'these filters'}.</div>
      )}
    </PageLayout>
  );
}
