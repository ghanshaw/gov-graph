import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_NATURAL_COURTS } from '../queries';
import PageLayout from '../components/PageLayout';
import { RailGroup, Fact } from '../components/Rail';
import Loading from '../components/Loading';

function formatDateRange(startDate, endDate) {
  const fmt = d => new Date(d + 'T00:00:00').getFullYear();
  return endDate ? `${fmt(startDate)} – ${fmt(endDate)}` : `${fmt(startDate)} – Present`;
}

export default function SupremeCourt() {
  const { data, loading } = useQuery(GET_NATURAL_COURTS);
  const courts = data?.naturalCourts || [];

  // Natural courts per Chief Justice, in the order they appear.
  const byChief = courts.reduce((acc, court) => {
    acc[court.chiefJustice] = (acc[court.chiefJustice] || 0) + 1;
    return acc;
  }, {});

  const rail = (
    <>
      <RailGroup title="Chief Justice">
        {Object.entries(byChief).map(([chief, count]) => (
          <Fact key={chief} label={chief}>{count}</Fact>
        ))}
        {!loading && courts.length === 0 && <p>No courts.</p>}
      </RailGroup>
      <RailGroup title="Source">
        <p>Majority opinions from CourtListener.</p>
      </RailGroup>
    </>
  );

  return (
    <PageLayout rail={rail}>
      <div className="crumbs">Supreme Court of the United States</div>
      <div className="page-head">
        <h1 className="page-title">
          Natural Courts
          {courts.length > 0 && <small>{courts.length} courts</small>}
        </h1>
      </div>
      <p className="lede">
        A natural court is the period during which no change in Court membership occurs. Browse majority opinions by court composition.
      </p>

      {loading && <Loading />}

      {courts.length > 0 && (
        <table className="records">
          <thead>
            <tr>
              <th>No.</th>
              <th>Court</th>
              <th className="date">Years</th>
            </tr>
          </thead>
          <tbody>
            {courts.map((court, i) => (
              <tr key={court.slug}>
                <td className="no">{courts.length - i}</td>
                <td className="title">
                  <Link to={`/supreme-court/${court.slug}`}>{court.name}</Link>
                  <span className="sub">{court.description}</span>
                  <div className="chips">
                    {court.justices.map(j => (
                      // Surname only: "John G. Roberts Jr." → "Roberts"
                      <span key={j} className="chip">{j.replace(/,? (Jr|Sr)\.?$/, '').split(' ').slice(-1)[0]}</span>
                    ))}
                  </div>
                </td>
                <td className="date">{formatDateRange(court.startDate, court.endDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageLayout>
  );
}
