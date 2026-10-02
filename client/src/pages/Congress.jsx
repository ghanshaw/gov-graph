import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_CONGRESSES } from '../queries';

const PARTY_COLOR = {
  'Democratic majority': 'rgba(59,130,246,0.15)',
  'Republican majority': 'rgba(239,68,68,0.15)',
};

const PARTY_BORDER = {
  'Democratic majority': 'rgba(59,130,246,0.3)',
  'Republican majority': 'rgba(239,68,68,0.3)',
};

const PARTY_TEXT = {
  'Democratic majority': '#93c5fd',
  'Republican majority': '#fca5a5',
};

export default function Congress() {
  const { data, loading } = useQuery(GET_CONGRESSES);
  const congresses = data?.congresses || [];

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
          United States Congress · Congress.gov
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
          Legislative Bills
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
          Browse bills introduced in the {congresses.length > 0 ? `${congresses[congresses.length - 1].number}th through ${congresses[0].number}th` : ''} Congress. Data sourced from the official Congress.gov API.
        </p>
      </div>

      {loading && (
        <div style={{ color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem' }}>
          Loading…
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {congresses.map((congress, i) => (
          <Link key={congress.number} to={`/congress/${congress.number}`} style={{ textDecoration: 'none' }}>
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
                {congress.number}
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
                    {congress.name}
                  </h2>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '0.65rem',
                    color: 'var(--gold)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}>
                    {congress.startYear} – {congress.endYear}
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
                  {congress.description}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[{ label: `Senate: ${congress.senate}`, val: congress.senate }, { label: `House: ${congress.house}`, val: congress.house }].map(({ label, val }) => (
                    <span key={label} style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: '0.6rem',
                      color: PARTY_TEXT[val] || 'var(--text-muted)',
                      background: PARTY_COLOR[val] || 'rgba(201,168,76,0.06)',
                      border: `1px solid ${PARTY_BORDER[val] || 'rgba(201,168,76,0.15)'}`,
                      borderRadius: '2px',
                      padding: '2px 7px',
                      letterSpacing: '0.03em',
                    }}>
                      {label}
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
