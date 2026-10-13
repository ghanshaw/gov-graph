import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_POPULATION_COLLECTIONS, GET_ACS_YEARS } from '../queries';
import PageLayout from '../components/PageLayout';
import { DEMOGRAPHY_TABS } from '../demography';
import Loading from '../components/Loading';
import { RailGroup } from '../components/Rail';

export const fileSize = bytes => (bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`);
export const filePath = path => `/population/file?path=${encodeURIComponent(path)}`;

// The files of a collection, grouped by the folder they sit in on www2.census.gov.
function FileList({ files }) {
  const folders = [];
  for (const f of files) {
    if (folders.at(-1)?.folder !== f.folder) folders.push({ folder: f.folder, files: [] });
    folders.at(-1).files.push(f);
  }
  return (
    <table className="records raw-files">
      <tbody>
        {folders.map(group => (
          <Fragment key={group.folder}>
            <tr className="year-row"><td colSpan={2}>{group.folder}/</td></tr>
            {group.files.map(f => (
              <tr key={f.path}>
                <td className="mono"><Link to={filePath(f.path)}>{f.name}</Link></td>
                <td className="date">{fileSize(f.size)}</td>
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

// The Source files tab of Demographic Data (pages/Demographics.jsx): the Census Bureau's files as
// published, each collection of them, and the American Community Survey's tables by year and place.
export default function Population() {
  const { data, loading, error } = useQuery(GET_POPULATION_COLLECTIONS);
  const { data: acsData } = useQuery(GET_ACS_YEARS);
  const collections = data?.populationCollections ?? [];
  const acsYears = acsData?.acsYears?.years ?? [];

  const rail = (
    <RailGroup title="On this page">
      <ol className="toc">
        <li><a href="#acs" className="plain"><span>American Community Survey</span></a></li>
        {collections.map(c => (
          <li key={c.id}><a href={`#${c.id}`} className="plain"><span>{c.title}</span></a></li>
        ))}
      </ol>
    </RailGroup>
  );

  return (
    <PageLayout rail={rail}>
      <div className="page-head">
        <h1 className="page-title">Demographic Data</h1>
      </div>
      <nav className="page-tabs" aria-label="Demographic Data">
        {DEMOGRAPHY_TABS.map(t => (
          <Link key={t.slug} to={`/demographics/${t.slug}`} className={t.files ? 'on' : undefined}>{t.label}</Link>
        ))}
      </nav>
      <p className="lede">
        The Census Bureau’s files the charts are read from, as published, kept in the data folder at their
        www2.census.gov paths: population and demographics of the United States, the states and the congressional districts.
      </p>

      <section id="acs" className="page-section pop-collection">
        <h2 className="section-title">American Community Survey, 1-year estimates</h2>
        <p className="pop-note">
          Sex, age, race, Hispanic origin, nativity, household and couple type (including same-sex couples), marital
          status, education, language, poverty, disability, income, earnings, inequality, employment, occupation,
          veterans, housing tenure and health insurance, for the nation, every state and every congressional district.
          The ACS began in 2005; there was no standard 1-year release for 2020. The Census Bureau does not ask about
          sexual orientation or gender identity in the census or the ACS.
        </p>
        {acsYears.length > 0 ? (
          <p className="pop-years">
            {acsYears.map(y => <Link key={y.year} className="chip" to={`/population/acs?year=${y.year}`}>{y.year}</Link>)}
          </p>
        ) : <p className="pop-note">Not downloaded yet.</p>}
      </section>

      {loading && <Loading />}
      {error && <div className="error">Failed to load the files: {error.message}</div>}
      {collections.map(c => (
        <section key={c.id} id={c.id} className="page-section pop-collection">
          <h2 className="section-title">{c.title}</h2>
          <p className="pop-note">{c.description}</p>
          <p className="pop-source">
            {c.sources.map(s => <a key={s} href={s} target="_blank" rel="noopener noreferrer">{s.replace('https://www2.census.gov/', '')} ↗</a>)}
          </p>
          {c.files.length === 0
            ? <p className="pop-note">Not downloaded yet (server/seed/fetch-population.js).</p>
            : (
              <details>
                <summary>{c.files.length} files</summary>
                <FileList files={c.files} />
              </details>
            )}
        </section>
      ))}
    </PageLayout>
  );
}
