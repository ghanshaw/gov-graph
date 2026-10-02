import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_TAG_PAGE } from '../queries';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import { RailGroup, Fact } from '../components/Rail';

function EntityRow({ href, external, title, meta }) {
  return (
    <tr>
      <td className="title">
        {external
          ? <a href={href} target="_blank" rel="noopener noreferrer">{title}</a>
          : <Link to={href}>{title}</Link>}
      </td>
      <td className="date">{meta ?? ''}</td>
    </tr>
  );
}

function DegradedRow({ entityId }) {
  return (
    <tr>
      <td className="meta">{entityId} (unavailable)</td>
      <td className="date" />
    </tr>
  );
}

function EntityTable({ label, children }) {
  return (
    <div className="page-section">
      <h2 className="section-title">{label}</h2>
      <table className="records">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default function TagPage() {
  const { word } = useParams();
  const { data, loading } = useQuery(GET_TAG_PAGE, { variables: { word } });

  const result = data?.tagPage;
  const tag = result?.tag;
  const eos = result?.executiveOrders || [];
  const cases = result?.scotusCases || [];
  const bills = result?.legislation || [];
  const total = eos.length + cases.length + bills.length;

  const rail = tag && (
    <>
      <RailGroup title="Tagged">
        <Fact label="Executive orders">{eos.length}</Fact>
        <Fact label="Supreme Court cases">{cases.length}</Fact>
        <Fact label="Legislation">{bills.length}</Fact>
      </RailGroup>
      <RailGroup title="Tag">
        <Fact label="Source">{tag.source}</Fact>
      </RailGroup>
    </>
  );

  return (
    <PageLayout rail={rail}>
      <Crumbs items={[{ label: 'Tags', to: '/tags' }, { label: word }]} />
      <div className="page-head">
        <h1 className="page-title">
          {word}
          {!loading && tag && <small>{total} {total === 1 ? 'document' : 'documents'}</small>}
        </h1>
      </div>

      {loading && <div className="state">Loading…</div>}

      {!loading && !tag && <div className="state">No tag found for “{word}”.</div>}

      {!loading && tag && (
        <>
          {eos.length > 0 && (
            <EntityTable label="Executive Orders">
              {eos.map(({ entityId, order }) =>
                order ? (
                  <EntityRow
                    key={entityId}
                    href={order.president ? `/${order.president}/executive-orders/eo/${order.number}` : order.url}
                    external={!order.president}
                    title={order.title || `EO ${entityId}`}
                    meta={order.dateSigned ? order.dateSigned.slice(0, 10) : undefined}
                  />
                ) : (
                  <DegradedRow key={entityId} entityId={entityId} />
                )
              )}
            </EntityTable>
          )}

          {cases.length > 0 && (
            <EntityTable label="Supreme Court">
              {cases.map(({ entityId, case: c }) =>
                c ? (
                  <EntityRow
                    key={entityId}
                    href={c.url}
                    external
                    title={c.caseName}
                    meta={c.dateFiled ? c.dateFiled.slice(0, 4) : undefined}
                  />
                ) : (
                  <DegradedRow key={entityId} entityId={entityId} />
                )
              )}
            </EntityTable>
          )}

          {bills.length > 0 && (
            <EntityTable label="Legislation">
              {bills.map(({ entityId, bill }) => {
                if (!bill) return <DegradedRow key={entityId} entityId={entityId} />;
                const href = `/congress/${bill.congress}/${bill.type.toLowerCase()}/${bill.number}`;
                return (
                  <EntityRow
                    key={entityId}
                    href={href}
                    title={bill.title || `${bill.type} ${bill.number}`}
                    meta={bill.introducedDate ? bill.introducedDate.slice(0, 10) : undefined}
                  />
                );
              })}
            </EntityTable>
          )}

          {total === 0 && <div className="state">No documents tagged yet.</div>}
        </>
      )}
    </PageLayout>
  );
}
