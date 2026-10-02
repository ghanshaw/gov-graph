import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_CONGRESSES } from '../queries';
import PageLayout from '../components/PageLayout';
import { RailGroup, Fact } from '../components/Rail';

const PARTY_CHIP = {
  'Democratic majority': 'chip dem',
  'Republican majority': 'chip rep',
};

export default function Congress() {
  const { data, loading } = useQuery(GET_CONGRESSES);
  const congresses = data?.congresses || [];

  const first = congresses[congresses.length - 1];
  const last = congresses[0];

  const rail = (
    <>
      <RailGroup title="Coverage">
        <Fact label="Congresses">{congresses.length || '…'}</Fact>
        {first && <Fact label="Years">{first.startYear} – {last.endYear}</Fact>}
      </RailGroup>
      <RailGroup title="Source">
        <p>Bills and laws from the official Congress.gov API.</p>
      </RailGroup>
    </>
  );

  return (
    <PageLayout rail={rail}>
      <div className="crumbs">United States Congress</div>
      <div className="page-head">
        <h1 className="page-title">
          Legislative Bills
          {congresses.length > 0 && <small>{congresses.length} Congresses</small>}
        </h1>
      </div>
      <p className="lede">
        Browse bills introduced in the {first ? `${first.number}th through ${last.number}th` : ''} Congress. Data sourced from the official Congress.gov API.
      </p>

      {loading && <div className="state">Loading…</div>}

      {congresses.length > 0 && (
        <table className="records">
          <thead>
            <tr>
              <th>No.</th>
              <th>Congress</th>
              <th className="date">Years</th>
            </tr>
          </thead>
          <tbody>
            {congresses.map(congress => (
              <tr key={congress.number}>
                <td className="no">{congress.number}</td>
                <td className="title">
                  <Link to={`/congress/${congress.number}`}>{congress.name}</Link>
                  <span className="sub">{congress.description}</span>
                  <div className="chips">
                    <span className={PARTY_CHIP[congress.senate] || 'chip'}>Senate: {congress.senate}</span>
                    <span className={PARTY_CHIP[congress.house] || 'chip'}>House: {congress.house}</span>
                  </div>
                </td>
                <td className="date">{congress.startYear} – {congress.endYear}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageLayout>
  );
}
