import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_REPORTS } from '../queries';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import { RailGroup, Fact } from '../components/Rail';
import Loading from '../components/Loading';
import { shortDate } from '../dates';

// Reports of investigations: commissions, congressional inquiries, special counsels. Each is read once
// into its parts (seed/load-reports.js); the list is newest first.
export default function Reports() {
  const { data, loading, error } = useQuery(GET_REPORTS);
  const reports = data?.reports ?? [];

  const rail = (
    <RailGroup title="Loaded">
      <Fact label="Reports">{reports.length}</Fact>
    </RailGroup>
  );

  return (
    <PageLayout rail={rail}>
      <Crumbs items={[{ label: 'Reports' }]} />
      <div className="page-head">
        <h1 className="page-title">Reports</h1>
      </div>
      <p className="lede">
        Reports of investigations: a commission created by a law or an order, a congressional inquiry or a special
        counsel examines one question and reports its findings and recommendations. A report has no legal force of its
        own; each is linked to what created the body that wrote it and to the laws that followed.
      </p>

      {loading && <Loading />}
      {error && <div className="error">Failed to load reports: {error.message}</div>}

      {reports.length > 0 && (
        <table className="records">
          <thead>
            <tr>
              <th className="date">Issued</th>
              <th>Report</th>
              <th>Kind</th>
            </tr>
          </thead>
          <tbody>
            {reports.map(r => (
              <tr key={r.slug}>
                <td className="date">{shortDate(r.dateIssued)}</td>
                <td className="title">
                  <Link to={`/reports/${r.slug}`}>{r.shortTitle ?? r.title}</Link>
                  <span className="sub">
                    {r.issuer}
                    {r.counts && ` · ${r.counts.chapters} chapters, ${r.counts.recommendations} recommendations, ${r.counts.notes.toLocaleString()} notes`}
                  </span>
                </td>
                <td>{r.kindLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageLayout>
  );
}
