import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_SOURCE_DATASETS } from '../queries';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import { RailGroup, RadioOptions, Fact } from '../components/Rail';
import Loading from '../components/Loading';
import SearchBox from '../components/SearchBox';
import { bytes, LICENCE_CHIP, accessChip, ABSTRACT_OPTIONS, publishers } from '../sources';

// Every dataset GovGraph uses (seed/data/sources.json): who publishes it, its terms, how it is fetched, and
// what was downloaded. Statistics first, then documents, each in the file's order.
export default function DataSources() {
  const { data, loading, error } = useQuery(GET_SOURCE_DATASETS);
  const [filters, setFilters] = useState({ publisher: null, licence: null, access: null, abstract: null });
  const [search, setSearch] = useState('');
  const all = data?.sourceDatasets ?? [];
  const vocabulary = data?.sourceVocabulary;

  // Words typed in the search field: a dataset matches when every word is in its name, description, notes or
  // its organizations' names.
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const text = d => [d.name, d.slug, d.description, d.notes, d.outsideAbstract,
    ...d.organizations.flatMap(({ organization: o }) => [o.name, o.shortName, o.parentName])].filter(Boolean).join(' ').toLowerCase();
  const matches = d => words.every(w => text(d).includes(w));

  // Each filter's test; a dataset shows when it matches the search and passes every filter that is set.
  const tests = {
    publisher: v => d => publishers(d).some(o => o.kind === v),
    licence: v => d => d.licence === v,
    access: v => d => d.accessUsed.includes(v),
    abstract: v => ABSTRACT_OPTIONS.find(o => o.value === v).test,
  };
  const passes = (d, except) => matches(d) && Object.entries(filters).every(([key, v]) => key === except || v == null || tests[key](v)(d));
  const shown = all.filter(d => passes(d));

  // A filter's options with how many datasets each would show, given the other filters; only those in use.
  const options = (key, labels) => {
    const rest = all.filter(d => passes(d, key));
    const list = Object.entries(labels)
      .map(([value, label]) => ({ value, label, n: rest.filter(tests[key](value)).length }))
      .filter(o => o.n > 0 || filters[key] === o.value);
    return [{ value: null, label: `All (${rest.length})` }, ...list.map(o => ({ value: o.value, label: `${o.label} (${o.n})` }))];
  };
  const set = key => value => setFilters(f => ({ ...f, [key]: value }));

  const files = all.reduce((n, d) => n + d.fileCount, 0);
  const size = all.reduce((n, d) => n + d.fileBytes, 0);
  const organizations = new Set(all.flatMap(d => publishers(d).map(o => o.slug))).size;

  const rail = vocabulary && (
    <>
      <RailGroup title="Collected">
        <Fact label="Datasets">{all.length}</Fact>
        <Fact label="Publishers">{organizations}</Fact>
        <Fact label="Files">{files.toLocaleString()}</Fact>
        <Fact label="On disk">{bytes(size)}</Fact>
      </RailGroup>
      <RailGroup title="Publisher">
        <RadioOptions label="Publisher" options={options('publisher', vocabulary.organizationKinds)} value={filters.publisher} onChange={set('publisher')} />
      </RailGroup>
      <RailGroup title="Terms">
        <RadioOptions label="Terms" options={options('licence', vocabulary.licences)} value={filters.licence} onChange={set('licence')} />
      </RailGroup>
      <RailGroup title="Fetched by">
        <RadioOptions label="Fetched by" options={options('access', vocabulary.access)} value={filters.access} onChange={set('access')} />
      </RailGroup>
      <RailGroup title="Statistical Abstract">
        <RadioOptions label="Statistical Abstract"
          options={options('abstract', Object.fromEntries(ABSTRACT_OPTIONS.map(o => [o.value, o.label])))}
          value={filters.abstract} onChange={set('abstract')} />
      </RailGroup>
    </>
  );

  const groups = vocabulary ? Object.entries(vocabulary.datasetKinds).map(([kind, label]) => [kind, label, shown.filter(d => d.kind === kind)]) : [];

  return (
    <PageLayout rail={rail}>
      <Crumbs items={[{ label: 'Sources' }]} />
      <div className="page-head">
        <h1 className="page-title">
          Data Sources <small>{shown.length === all.length ? `${all.length} datasets` : `${shown.length} of ${all.length} datasets`}</small>
        </h1>
        <SearchBox value={search} onChange={setSearch} placeholder="Dataset, publisher, subject…" />
      </div>
      <p className="lede">
        Every dataset GovGraph uses: who publishes it, what its terms allow, how it is fetched, and each file
        downloaded. Federal works are public domain; other publishers' terms were read on their sites. The 2012
        Statistical Abstract of the United States is the list of what to collect; datasets it does not cite say why
        they are here.
      </p>

      {loading && <Loading />}
      {error && <div className="error">Failed to load sources: {error.message}</div>}

      {groups.filter(([, , list]) => list.length).map(([kind, label, list]) => (
        <section key={kind} id={kind} className="page-section">
          <h2 className="section-title">{label}</h2>
          <table className="records">
            <thead>
              <tr>
                <th>Dataset</th>
                <th className="wide-only">Terms</th>
                <th className="wide-only">Fetched by</th>
                <th className="date">Files</th>
              </tr>
            </thead>
            <tbody>
              {list.map(d => (
                <tr key={d.slug}>
                  <td className="title">
                    <Link to={`/sources/${d.slug}`}>{d.name}</Link>
                    <span className="sub">
                      {publishers(d).map(o => o.shortName).join(', ')}
                      {d.status !== 'active' && ` · ${d.statusLabel}`}
                      {d.seriesCount > 0 && ` · ${d.seriesCount.toLocaleString()} series`}
                    </span>
                    {d.inAbstract === false && (
                      <span className="sub source-flag" title={d.outsideAbstract}>Not in the Statistical Abstract: {d.outsideAbstract}</span>
                    )}
                  </td>
                  <td className="wide-only"><span className={LICENCE_CHIP[d.licence]}>{d.licenceLabel}</span></td>
                  <td className="wide-only">
                    <div className="chips">
                      {d.collected ? d.accessUsed.map(a => <span key={a} className={accessChip(a)}>{vocabulary.access[a]}</span>)
                        : <span className="chip">Not collected</span>}
                    </div>
                  </td>
                  <td className="date">
                    {d.fileCount ? d.fileCount.toLocaleString() : '—'}
                    {d.fileCount > 0 && <span className="sub">{bytes(d.fileBytes)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      {!loading && all.length > 0 && shown.length === 0 && (
        <div className="state">No dataset matches {words.length ? `“${search.trim()}”` : 'these filters'}.</div>
      )}
    </PageLayout>
  );
}
