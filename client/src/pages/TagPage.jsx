import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_TAG_PAGE } from '../queries';

function SectionHeader({ label }) {
  return (
    <div style={{
      fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.7rem', color: 'var(--gold)',
      letterSpacing: '0.1em', textTransform: 'uppercase',
      paddingBottom: '0.5rem', borderBottom: '1px solid rgba(201,168,76,0.15)',
      marginBottom: '0.75rem',
    }}>
      {label}
    </div>
  );
}

function EntityRow({ href, external, title, meta }) {
  const inner = (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '0.75rem 0', borderBottom: '1px solid rgba(201,168,76,0.06)',
      color: 'var(--cream)', textDecoration: 'none',
    }}>
      <span style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '0.95rem' }}>{title}</span>
      {meta && <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '1rem', whiteSpace: 'nowrap' }}>{meta}</span>}
    </div>
  );

  const linkStyle = { textDecoration: 'none', color: 'inherit', display: 'block' };
  const hoverOn = e => e.currentTarget.querySelector('span').style.color = 'var(--gold)';
  const hoverOff = e => e.currentTarget.querySelector('span').style.color = 'var(--cream)';

  if (external) {
    return <a href={href} target="_blank" rel="noopener noreferrer" style={linkStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>{inner}</a>;
  }
  return <Link to={href} style={linkStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>{inner}</Link>;
}

function DegradedRow({ entityId }) {
  return (
    <div style={{ padding: '0.75rem 0', borderBottom: '1px solid rgba(201,168,76,0.06)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
      {entityId} <span style={{ fontSize: '0.65rem' }}>(unavailable)</span>
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

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '0.5rem' }}>
        <Link to="/tags" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.7rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none' }}>
          ← Tags
        </Link>
      </div>

      <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '2.2rem', color: 'var(--cream)', margin: '0.5rem 0 0.25rem' }}>
        {word}
      </h1>

      {!loading && tag && (
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
          {total} {total === 1 ? 'entity' : 'entities'} · source: {tag.source}
        </div>
      )}

      {loading && <div style={{ color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.8rem' }}>Loading…</div>}

      {!loading && !tag && (
        <div style={{ color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.85rem', marginTop: '1rem' }}>
          No tag found for "{word}".
        </div>
      )}

      {!loading && tag && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {eos.length > 0 && (
            <section>
              <SectionHeader label="Executive Orders" />
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
            </section>
          )}

          {cases.length > 0 && (
            <section>
              <SectionHeader label="Supreme Court" />
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
            </section>
          )}

          {bills.length > 0 && (
            <section>
              <SectionHeader label="Legislation" />
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
            </section>
          )}

          {total === 0 && (
            <div style={{ color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.85rem' }}>
              No entities tagged yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
