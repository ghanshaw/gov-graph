import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_ACS_YEARS, GET_ACS_GEOGRAPHIES, GET_ACS_TABLE } from '../queries';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import Loading from '../components/Loading';
import { RailGroup, RadioOptions } from '../components/Rail';

const LEVEL_LABEL = { nation: 'Nation', state: 'States', district: 'Congressional districts' };

// One American Community Survey table for one place and year, as published: each row's label,
// estimate and margin of error. Year, place and table are in the address (?year=&geo=&table=).
export default function PopulationAcs() {
  const [params, setParams] = useSearchParams();
  const { data: yearsData, loading: yearsLoading } = useQuery(GET_ACS_YEARS);
  const years = yearsData?.acsYears?.years ?? [];
  const titles = Object.fromEntries((yearsData?.acsYears?.tables ?? []).map(t => [t.id, t.title]));

  const year = Number(params.get('year')) || years.at(-1)?.year || null;
  const yearInfo = years.find(y => y.year === year);
  const { data: geoData } = useQuery(GET_ACS_GEOGRAPHIES, { variables: { year }, skip: !year });
  const geos = geoData?.acsGeographies ?? [];
  const geoid = params.get('geo') && geos.some(g => g.geoid === params.get('geo'))
    ? params.get('geo')
    : geos.find(g => g.level === 'nation')?.geoid ?? null;
  const table = params.get('table') && yearInfo?.tables.includes(params.get('table'))
    ? params.get('table')
    : yearInfo?.tables[0] ?? null;
  const { data, loading, error } = useQuery(GET_ACS_TABLE, {
    variables: { year, geoid, table }, skip: !year || !geoid || !table,
  });
  const result = data?.acsTable;
  const set = changes => setParams({ ...(year ? { year } : {}), ...(geoid ? { geo: geoid } : {}), ...(table ? { table } : {}), ...changes });

  // Places grouped by level; districts under their state, in the order the files list them.
  const groups = ['nation', 'state', 'district'].map(level => ({ level, items: geos.filter(g => g.level === level) }))
    .filter(g => g.items.length > 0);

  const rail = (
    <>
      <RailGroup title="Year">
        <RadioOptions label="Year" options={years.map(y => ({ label: String(y.year), value: y.year }))} value={year}
          onChange={y => set({ year: y })} />
      </RailGroup>
      <RailGroup title="Place">
        <select className="rail-select" aria-label="Place" value={geoid ?? ''} onChange={e => set({ geo: e.target.value })}>
          {groups.map(g => (
            <optgroup key={g.level} label={LEVEL_LABEL[g.level]}>
              {g.items.map(item => <option key={item.geoid} value={item.geoid}>{item.name}</option>)}
            </optgroup>
          ))}
        </select>
      </RailGroup>
      <RailGroup title="Table">
        <ol className="toc">
          {(yearInfo?.tables ?? []).map(id => (
            <li key={id}>
              <a href={`?year=${year}&geo=${geoid}&table=${id}`} className={id === table ? 'on' : undefined}
                onClick={e => { e.preventDefault(); set({ table: id }); }}>
                <span className="toc-num">{id}</span><span>{titles[id]}</span>
              </a>
            </li>
          ))}
        </ol>
      </RailGroup>
    </>
  );

  return (
    <PageLayout rail={rail}>
      <Crumbs items={[{ label: 'Demographic Data', to: '/demographics/files' }, { label: 'American Community Survey' }]} />
      <div className="page-head">
        <h1 className="page-title">
          {table ? `${table} · ${result?.title ?? titles[table] ?? ''}` : 'American Community Survey'}
        </h1>
      </div>
      {yearsLoading && <Loading />}
      {!yearsLoading && years.length === 0 && <div className="state">The ACS files have not been downloaded yet.</div>}
      {result && (
        <>
          <dl className="facts">
            <div><dt>Place</dt><dd>{result.name}</dd></div>
            <div><dt>Year</dt><dd>{result.year} (1-year estimates)</dd></div>
            {result.universe && <div><dt>Universe</dt><dd>{result.universe}</dd></div>}
            <div><dt>GEOID</dt><dd className="mono">{result.geoid}</dd></div>
          </dl>
          {result.labels_from === null && (
            <p className="pop-note">The 2005 files list no row labels, and this table changed shape in 2006, so its rows are numbered only.</p>
          )}
          {result.labels_from && (
            <p className="pop-note">Row labels from the 2006 lookup (the 2005 files list none; the table has the same cells).</p>
          )}
          <table className="records acs-table">
            <thead>
              <tr><th className="date">Line</th><th>Label</th><th className="date">Estimate</th><th className="date">Margin of error</th></tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i} className={row.line == null ? 'heading' : undefined}>
                  <td className="date">{row.line ?? ''}</td>
                  <td style={row.indent ? { paddingLeft: `${12 + row.indent * 16}px` } : undefined}>{row.label ?? ''}</td>
                  <td className="date">{row.estimate ?? ''}</td>
                  <td className="date">{row.moe != null ? `±${row.moe}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="source-note">
            American Community Survey {result.year} 1-year summary file, as published by the Census Bureau.{' '}
            <Link to="/population#acs">About the sources</Link>
          </p>
        </>
      )}
      {loading && <Loading />}
      {error && <div className="error">Failed to read the table: {error.message}</div>}
      {!loading && !result && table && geoid && !error && <div className="state">This table is not in that year’s files for this place.</div>}
    </PageLayout>
  );
}
