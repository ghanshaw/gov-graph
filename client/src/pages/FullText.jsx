import { useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_EXECUTIVE_ORDER, GET_EXECUTIVE_ORDER_TEXT } from '../queries';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';

export default function FullText() {
  const { slug, docType, number } = useParams();

  const { data: metaData } = useQuery(GET_EXECUTIVE_ORDER, { variables: { number } });
  const { data, loading, error } = useQuery(GET_EXECUTIVE_ORDER_TEXT, { variables: { number } });

  const order = metaData?.executiveOrder;
  const html = data?.executiveOrderText;

  const head = (
    <>
      <Crumbs items={[
        { label: 'Executive Orders', to: `/${slug}/${docType}` },
        { label: number, to: `/${slug}/${docType}/eo/${number}` },
        { label: 'Full text' },
      ]} />
      <span className="eyebrow">Executive Order {number}</span>
      {order && <h1 className="doc-title">{order.title}</h1>}
    </>
  );

  return (
    <PageLayout head={head}>
      {loading && <div className="state">Loading…</div>}

      {error && <div className="error">Error: {error.message}</div>}

      {!loading && !error && !html && (
        <div className="state">Full text not available for this order.</div>
      )}

      {html && (
        <div
          dangerouslySetInnerHTML={{ __html: html }}
          className="eo-full-text"
        />
      )}
    </PageLayout>
  );
}
