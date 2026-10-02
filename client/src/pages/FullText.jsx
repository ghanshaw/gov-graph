import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_EXECUTIVE_ORDER, GET_EXECUTIVE_ORDER_TEXT } from '../queries';

export default function FullText() {
  const { slug, docType, number } = useParams();

  const { data: metaData } = useQuery(GET_EXECUTIVE_ORDER, { variables: { number } });
  const { data, loading, error } = useQuery(GET_EXECUTIVE_ORDER_TEXT, { variables: { number } });

  const order = metaData?.executiveOrder;
  const html = data?.executiveOrderText;

  return (
    <main style={{ maxWidth: '820px', margin: '0 auto', padding: '3rem 2rem' }}>
      <Link to={`/${slug}/${docType}/eo/${number}`} style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        textDecoration: 'none',
        letterSpacing: '0.08em',
        marginBottom: '3rem',
        transition: 'color 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--gold)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        ← Back to Executive Order {number}
      </Link>

      {order && (
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 'clamp(1.4rem, 3vw, 2rem)',
          fontWeight: 700,
          color: 'var(--cream)',
          margin: '0 0 2.5rem 0',
          lineHeight: 1.2,
        }}>
          {order.title}
        </h1>
      )}

      {loading && (
        <div style={{ color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem' }}>
          Loading…
        </div>
      )}

      {error && (
        <div style={{ color: '#e88', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.8rem' }}>
          Error: {error.message}
        </div>
      )}

      {!loading && !error && !html && (
        <div style={{ color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
          Full text not available for this order.
        </div>
      )}

      {html && (
        <div
          dangerouslySetInnerHTML={{ __html: html }}
          className="eo-full-text"
        />
      )}
    </main>
  );
}
