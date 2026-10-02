import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_EXECUTIVE_ORDERS } from '../queries';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import { RailGroup, Fact } from '../components/Rail';

const PRESIDENT_META = {
  'barack-obama': { name: 'Barack Obama', ordinal: '44th', years: '2009 – 2017' },
  'donald-trump':    { name: 'Donald Trump', ordinal: '45th', years: '2017 – 2021' },
  'donald-trump-47': { name: 'Donald Trump', ordinal: '47th', years: '2025 – present' },
  'joseph-biden': { name: 'Joe Biden',    ordinal: '46th', years: '2021 – 2025' },
};

const DOCUMENT_TYPES = [
  {
    key: 'executive-orders',
    label: 'Executive Orders',
    description: 'Directives issued by the President that manage operations of the federal government.',
  },
  {
    key: 'memoranda',
    label: 'Presidential Memoranda',
    description: 'Official communications used to direct actions of executive branch departments and agencies.',
  },
];

function useCount(president, documentType) {
  const { data } = useQuery(GET_EXECUTIVE_ORDERS, {
    variables: { president, documentType, page: 1, perPage: 1 },
  });
  return data?.executiveOrders?.totalCount ?? null;
}

export default function President() {
  const { slug } = useParams();
  const meta = PRESIDENT_META[slug] || { name: slug, ordinal: '', years: '' };
  const eoCount = useCount(slug, 'executive_order');
  const memoCount = useCount(slug, 'memorandum');
  const counts = { 'executive-orders': eoCount, memoranda: memoCount };

  const rail = (
    <>
      <RailGroup title="In office">
        {meta.ordinal && <Fact label="President">{meta.ordinal}</Fact>}
        {meta.years && <Fact label="Term">{meta.years}</Fact>}
      </RailGroup>
      <RailGroup title="Documents">
        {DOCUMENT_TYPES.map(dt => (
          <Fact key={dt.key} label={dt.label}>{counts[dt.key] != null ? counts[dt.key].toLocaleString() : '…'}</Fact>
        ))}
      </RailGroup>
    </>
  );

  return (
    <PageLayout rail={rail}>
      <Crumbs items={[{ label: 'Presidents', to: '/' }, { label: meta.name }]} />
      <div className="page-head">
        <h1 className="page-title">
          {meta.name}
          {meta.ordinal && <small>{meta.ordinal} President · {meta.years}</small>}
        </h1>
      </div>

      <table className="records">
        <thead>
          <tr>
            <th>Document type</th>
            <th className="date">Documents</th>
          </tr>
        </thead>
        <tbody>
          {DOCUMENT_TYPES.map(dt => (
            <tr key={dt.key}>
              <td className="title">
                <Link to={`/${slug}/${dt.key}`}>{dt.label}</Link>
                <span className="sub">{dt.description}</span>
              </td>
              <td className="date">{counts[dt.key] != null ? counts[dt.key].toLocaleString() : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageLayout>
  );
}
