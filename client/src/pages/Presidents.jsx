import { Link } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import { RailGroup, Fact } from '../components/Rail';

// Most recent first.
const PRESIDENTS = [
  {
    slug: 'donald-trump-47',
    name: 'Donald Trump',
    ordinal: '47th',
    years: '2025 – present',
    party: 'Republican',
    description: 'Second term beginning January 2025.',
  },
  {
    slug: 'joseph-biden',
    name: 'Joe Biden',
    ordinal: '46th',
    years: '2021 – 2025',
    party: 'Democrat',
    description: 'One term focused on pandemic recovery, infrastructure investment, and climate legislation.',
  },
  {
    slug: 'donald-trump',
    name: 'Donald Trump',
    ordinal: '45th',
    years: '2017 – 2021',
    party: 'Republican',
    description: 'One term marked by deregulation, tax reform, and an America-first foreign policy.',
  },
  {
    slug: 'barack-obama',
    name: 'Barack Obama',
    ordinal: '44th',
    years: '2009 – 2017',
    party: 'Democrat',
    description: 'Two terms marked by the Affordable Care Act, economic recovery, and foreign policy realignment.',
  },
];

const PARTY_CHIP = { Democrat: 'chip dem', Republican: 'chip rep' };

export default function Presidents() {
  const rail = (
    <>
      <RailGroup title="Coverage">
        <Fact label="Administrations">{PRESIDENTS.length}</Fact>
        <Fact label="Years">2009 – present</Fact>
      </RailGroup>
      <RailGroup title="Source">
        <p>Presidential documents as published in the Federal Register.</p>
      </RailGroup>
    </>
  );

  return (
    <PageLayout rail={rail}>
      <div className="page-head">
        <h1 className="page-title">Presidents <small>{PRESIDENTS.length} administrations</small></h1>
      </div>
      <p className="lede">
        Browse presidential actions by administration, sourced directly from the Federal Register.
      </p>

      <table className="records">
        <thead>
          <tr>
            <th>No.</th>
            <th>President</th>
            <th className="wide-only">Party</th>
            <th className="date">In office</th>
          </tr>
        </thead>
        <tbody>
          {PRESIDENTS.map(p => (
            <tr key={p.slug}>
              <td className="no">{p.ordinal}</td>
              <td className="title">
                <Link to={`/${p.slug}`}>{p.name}</Link>
                <span className="sub">{p.description}</span>
              </td>
              <td className="wide-only"><span className={PARTY_CHIP[p.party] || 'chip'}>{p.party}</span></td>
              <td className="date">{p.years}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageLayout>
  );
}
