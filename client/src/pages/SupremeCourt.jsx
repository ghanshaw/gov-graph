import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_NATURAL_COURTS } from '../queries';

function formatDateRange(startDate, endDate) {
  const fmt = d => new Date(d + 'T00:00:00').getFullYear();
  return endDate ? `${fmt(startDate)} – ${fmt(endDate)}` : `${fmt(startDate)} – Present`;
}

export default function SupremeCourt() {
  const { data, loading } = useQuery(GET_NATURAL_COURTS);
  const courts = data?.naturalCourts || [];

  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '5rem 2rem' }}>
      <div style={{ marginBottom: '4rem' }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.7rem',
          color: 'var(--gold)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginBottom: '0.75rem',
        }}>
          Supreme Court of the United States · CourtListener
        </div>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          fontWeight: 900,
          color: 'var(--cream)',
          margin: '0 0 1rem 0',
          lineHeight: 1.1,
          letterSpacing: '-0.01em',
        }}>
          Natural Courts
        </h1>
        <p style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: '1rem',
          color: 'var(--text-muted)',
          margin: 0,
          maxWidth: '520px',
          lineHeight: 1.7,
          fontWeight: 300,
        }}>
          A natural court is the period during which no change in Court membership occurs. Browse majority opinions by court composition.
        </p>
      </div>

      {loading && (
        <div style={{ color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem' }}>
          Loading…
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {courts.map((court, i) => (
          <Link key={court.slug} to={`/supreme-court/${court.slug}`} style={{ textDecoration: 'none' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2rem',
                padding: '2rem 2.5rem',
                background: 'rgba(17,32,64,0.5)',
                border: '1px solid rgba(201,168,76,0.15)',
                borderRadius: '6px',
                transition: 'border-color 0.2s, background 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)';
                e.currentTarget.style.background = 'rgba(17,32,64,0.8)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(201,168,76,0.15)';
                e.currentTarget.style.background = 'rgba(17,32,64,0.5)';
              }}
            >
              <div style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '2rem',
                fontWeight: 900,
                color: 'rgba(201,168,76,0.2)',
                lineHeight: 1,
                flexShrink: 0,
                minWidth: '2.5rem',
                textAlign: 'right',
              }}>
                {courts.length - i}
              </div>

              <div style={{ borderLeft: '1px solid rgba(201,168,76,0.2)', paddingLeft: '2rem', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                  <h2 style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: '1.35rem',
                    fontWeight: 700,
                    color: 'var(--cream)',
                    margin: 0,
                  }}>
                    {court.name}
                  </h2>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '0.65rem',
                    color: 'var(--gold)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}>
                    {formatDateRange(court.startDate, court.endDate)}
                  </span>
                </div>
                <p style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: '0.875rem',
                  color: 'var(--text-muted)',
                  margin: '0 0 0.75rem 0',
                  fontWeight: 300,
                  lineHeight: 1.5,
                }}>
                  {court.description}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {court.justices.map(j => (
                    <span key={j} style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: '0.6rem',
                      color: 'var(--text-muted)',
                      background: 'rgba(201,168,76,0.06)',
                      border: '1px solid rgba(201,168,76,0.15)',
                      borderRadius: '2px',
                      padding: '2px 7px',
                      letterSpacing: '0.03em',
                    }}>
                      {j.split(' ').slice(-1)[0]}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ color: 'var(--gold)', fontSize: '1.25rem', flexShrink: 0, opacity: 0.6 }}>→</div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
