import { Link } from 'react-router-dom';

const PRESIDENT_DISPLAY = {
  'donald-trump': 'Trump (45th)',
  'joe-biden': 'Biden',
  'barack-obama': 'Obama',
};

export default function ExecutiveOrderCard({ order, slug, docType, showPresident = false }) {
  const formattedDate = order.dateSigned
    ? new Date(order.dateSigned + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Date unknown';

  return (
    <Link
      to={`/${slug}/${docType}/eo/${order.number}`}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <article style={{
        background: 'rgba(17,32,64,0.6)',
        border: '1px solid rgba(201,168,76,0.15)',
        borderRadius: '4px',
        padding: '1.5rem',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
        onMouseEnter={e => {
          e.currentTarget.style.border = '1px solid rgba(201,168,76,0.5)';
          e.currentTarget.style.background = 'rgba(17,32,64,0.9)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.border = '1px solid rgba(201,168,76,0.15)';
          e.currentTarget.style.background = 'rgba(17,32,64,0.6)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        {/* Left accent bar */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '3px',
          background: 'linear-gradient(to bottom, var(--gold), transparent)',
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', gap: '1rem' }}>
          <div>
            {order.number && (
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.7rem',
                color: 'var(--gold)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: '0.4rem',
              }}>
                E.O. {order.number}
              </span>
            )}
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.05rem',
              fontWeight: 600,
              color: 'var(--cream)',
              margin: 0,
              lineHeight: 1.35,
            }}>
              {order.title}
            </h2>
          </div>

          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
            textAlign: 'right',
            flexShrink: 0,
          }}>
            {formattedDate}
          {showPresident && order.president && (
            <span style={{
              display: 'block',
              marginTop: '0.25rem',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.6rem',
              color: 'var(--gold)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              opacity: 0.8,
            }}>
              {PRESIDENT_DISPLAY[order.president] || order.president}
            </span>
          )}
          </div>
        </div>

        {order.abstract && (
          <p style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            margin: '0 0 1rem 0',
            lineHeight: 1.6,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {order.abstract}
          </p>
        )}

        {order.topics && order.topics.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {order.topics.slice(0, 4).map(topic => (
              <span key={topic} style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.6rem',
                color: 'var(--text-muted)',
                background: 'rgba(201,168,76,0.08)',
                border: '1px solid rgba(201,168,76,0.2)',
                borderRadius: '2px',
                padding: '2px 8px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}>
                {topic}
              </span>
            ))}
          </div>
        )}

        <div style={{
          position: 'absolute',
          right: '1.5rem',
          bottom: '1.25rem',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.7rem',
          color: 'var(--gold)',
          opacity: 0.6,
        }}>→</div>
      </article>
    </Link>
  );
}
