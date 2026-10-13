import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_USC_TITLES } from '../queries';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import Loading from '../components/Loading';
import { RailGroup, RadioOptions, CheckOption } from '../components/Rail';
import { titleCase } from '../usc';

const POSITIVE_LAW = [
  { value: null, label: 'All' },
  { value: true, label: 'Positive law' },
  { value: false, label: 'Not positive law' },
];

// "10" and "1074c" → /code/10/1074c. Without a title fixed by the page, both are asked for.
export function GoToSection({ title }) {
  const navigate = useNavigate();
  const [titleValue, setTitleValue] = useState(title ?? '');
  const [section, setSection] = useState('');
  const go = e => {
    e.preventDefault();
    const t = titleValue.trim().toLowerCase();
    const s = section.trim().replace(/^§+\s*/, '').replace(/[–—]/g, '-');
    if (t && s) navigate(`/code/${t}/${encodeURIComponent(s)}`);
    else if (t) navigate(`/code/${t}`);
  };
  return (
    <form className="usc-goto" onSubmit={go}>
      {title == null && (
        <input aria-label="Title" placeholder="Title" value={titleValue} onChange={e => setTitleValue(e.target.value)} size={4} />
      )}
      <input aria-label="Section" placeholder="Section, e.g. 1074c" value={section} onChange={e => setSection(e.target.value)} />
      <button type="submit" className="btn">Go</button>
    </form>
  );
}

// The titles of the U.S. Code, as loaded from the Law Revision Counsel's release point.
export default function UsCode() {
  const { data, loading, error } = useQuery(GET_USC_TITLES);
  const [positiveLaw, setPositiveLaw] = useState(null);
  const [appendices, setAppendices] = useState(false);
  const titles = data?.uscTitles ?? [];
  const shown = titles.filter(t => (positiveLaw == null || t.positiveLaw === positiveLaw) && (appendices || !t.appendix));
  const releases = [...new Set(titles.map(t => t.release))];

  const rail = (
    <>
      <RailGroup title="Go to a section">
        <GoToSection />
      </RailGroup>
      <RailGroup title="Enacted as law">
        <RadioOptions label="Enacted as law" options={POSITIVE_LAW} value={positiveLaw} onChange={setPositiveLaw} />
      </RailGroup>
      <RailGroup title="Show">
        <CheckOption label="Appendix titles" checked={appendices} onChange={setAppendices} />
      </RailGroup>
      {releases.length > 0 && (
        <p className="source-note">
          Current through Public Law {releases.join(', ')}: the Law Revision Counsel’s release point in USLM XML.
        </p>
      )}
    </>
  );

  return (
    <PageLayout rail={rail}>
      <Crumbs items={[{ label: 'U.S. Code' }]} />
      <div className="page-head">
        <h1 className="page-title">
          United States Code
          {titles.length > 0 && <small>{shown.length} titles</small>}
        </h1>
      </div>
      <p className="lede">
        The general and permanent laws of the United States, arranged by subject. A title marked positive law was itself
        enacted by Congress; the others are the Law Revision Counsel’s arrangement of the laws as enacted.
      </p>

      {loading && <Loading label="Loading titles…" />}
      {error && <div className="error">Failed to load the U.S. Code: {error.message}</div>}
      {!loading && !error && titles.length === 0 && <div className="state">The U.S. Code has not been loaded yet.</div>}
      {shown.length > 0 && (
        <table className="records">
          <thead>
            <tr><th>Title</th><th>Name</th><th>Status</th><th className="date">Sections</th></tr>
          </thead>
          <tbody>
            {shown.map(t => (
              <tr key={t.number}>
                <td className="no"><Link to={`/code/${t.number}`}>{t.number.toUpperCase()}</Link></td>
                <td className="title"><Link to={`/code/${t.number}`}>{titleCase(t.name)}</Link></td>
                <td>{t.positiveLaw ? <span className="chip accent">Positive law</span> : t.appendix ? <span className="chip">Appendix</span> : null}</td>
                <td className="date">{t.sectionCount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageLayout>
  );
}
