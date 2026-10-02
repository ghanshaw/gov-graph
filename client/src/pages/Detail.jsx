import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_EXECUTIVE_ORDER } from '../queries';
import TagPanel from '../components/TagPanel';

const PRESIDENT_NAMES = {
  'barack-obama':    'Barack Obama',
  'donald-trump':    'Donald Trump',
  'donald-trump-47': 'Donald Trump',
  'joseph-biden':    'Joe Biden',
};

export default function Detail() {
  const { slug, docType, number } = useParams();
  const { data, loading, error } = useQuery(GET_EXECUTIVE_ORDER, {
    variables: { number },
  });

  const order = data?.executiveOrder;

  const formattedDate = order?.dateSigned
    ? new Date(order.dateSigned + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <main style={{ maxWidth: '820px', margin: '0 auto', padding: '3rem 2rem' }}>

      {/* Back */}
      <Link to={`/${slug}/${docType}`} style={{
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
        ← All Executive Orders
</Link>

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

      {!loading && !error && !order && (
        <div style={{ color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
          Executive Order not found.
        </div>
      )}

      {order && (
        <article>
          {/* EO number badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.5rem',
          }}>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.7rem',
              color: 'var(--gold)',
              background: 'rgba(201,168,76,0.1)',
              border: '1px solid rgba(201,168,76,0.3)',
              borderRadius: '3px',
              padding: '4px 12px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              Executive Order {order.number}
            </div>
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(1.6rem, 4vw, 2.5rem)',
            fontWeight: 700,
            color: 'var(--cream)',
            margin: '0 0 1.5rem 0',
            lineHeight: 1.2,
            letterSpacing: '-0.01em',
          }}>
            {order.title}
          </h1>

          {/* Metadata row */}
          <div style={{
            display: 'flex',
            gap: '2rem',
            flexWrap: 'wrap',
            marginBottom: '2.5rem',
            paddingBottom: '2rem',
            borderBottom: '1px solid rgba(201,168,76,0.15)',
          }}>
            {formattedDate && (
              <div>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '0.6rem',
                  color: 'var(--gold)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  marginBottom: '0.3rem',
                }}>Signed</div>
                <div style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: '0.9rem',
                  color: 'var(--cream)',
                }}>
                  {formattedDate}
                </div>
              </div>
            )}

            <div>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.6rem',
                color: 'var(--gold)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: '0.3rem',
              }}>President</div>
              <div style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: '0.9rem',
                color: 'var(--cream)',
              }}>
                {PRESIDENT_NAMES[slug] ?? slug}
              </div>
            </div>
          </div>

          {/* Abstract */}
          {order.abstract && (
            <div style={{ marginBottom: '2.5rem' }}>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.6rem',
                color: 'var(--gold)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: '1rem',
              }}>Summary</div>
              <p style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: '1.05rem',
                color: 'var(--cream)',
                lineHeight: 1.75,
                margin: 0,
                fontWeight: 300,
                borderLeft: '3px solid rgba(201,168,76,0.4)',
                paddingLeft: '1.5rem',
              }}>
                {order.abstract}
              </p>
            </div>
          )}

          {/* Topics */}
          {order.topics && order.topics.length > 0 && (
            <div style={{ marginBottom: '2.5rem' }}>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.6rem',
                color: 'var(--gold)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: '0.75rem',
              }}>Topics</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {order.topics.map(topic => (
                  <span key={topic} style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '0.65rem',
                    color: 'var(--text-muted)',
                    background: 'rgba(201,168,76,0.08)',
                    border: '1px solid rgba(201,168,76,0.2)',
                    borderRadius: '2px',
                    padding: '4px 10px',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}>
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            paddingTop: '2rem',
            borderTop: '1px solid rgba(201,168,76,0.15)',
          }}>
            {order.url && (
              <a
                href={order.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '0.75rem',
                  color: 'var(--navy)',
                  background: 'var(--gold)',
                  padding: '10px 20px',
                  borderRadius: '3px',
                  textDecoration: 'none',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--gold-light)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--gold)'}
              >
                View on Federal Register ↗
              </a>
            )}
            {order.bodyHtmlUrl && (
              <Link
                to={`/${slug}/${docType}/eo/${order.number}/text`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '0.75rem',
                  color: 'var(--gold)',
                  background: 'transparent',
                  padding: '10px 20px',
                  borderRadius: '3px',
                  textDecoration: 'none',
                  border: '1px solid rgba(201,168,76,0.4)',
                  letterSpacing: '0.06em',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)'}
              >
                Full Text
              </Link>
            )}
          </div>

          <TagPanel entityType="executive_order" entityId={order.number} />
        </article>
      )}
    </main>
  );
}
