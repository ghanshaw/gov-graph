import { Link } from 'react-router-dom';

const PRESIDENTS = [
  {
    slug: 'barack-obama',
    name: 'Barack Obama',
    ordinal: '44th',
    years: '2009 – 2017',
    party: 'Democrat',
    description: 'Two terms marked by the Affordable Care Act, economic recovery, and foreign policy realignment.',
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
    slug: 'joseph-biden',
    name: 'Joe Biden',
    ordinal: '46th',
    years: '2021 – 2025',
    party: 'Democrat',
    description: 'One term focused on pandemic recovery, infrastructure investment, and climate legislation.',
  },
  {
    slug: 'donald-trump-47',
    name: 'Donald Trump',
    ordinal: '47th',
    years: '2025 – present',
    party: 'Republican',
    description: 'Second term beginning January 2025.',
  },
];

export default function Presidents() {
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
          Presidential Actions · Federal Register
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
          Presidents
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
          Browse presidential actions by administration, sourced directly from the Federal Register.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {PRESIDENTS.map(p => (
          <Link key={p.slug} to={`/${p.slug}`} style={{ textDecoration: 'none' }}>
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
              {/* Ordinal badge */}
              <div style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '2.5rem',
                fontWeight: 900,
                color: 'rgba(201,168,76,0.2)',
                lineHeight: 1,
                flexShrink: 0,
                minWidth: '3.5rem',
                textAlign: 'right',
              }}>
                {p.ordinal.replace('th', '')}
                <span style={{ fontSize: '1rem', fontWeight: 400, verticalAlign: 'super' }}>th</span>
              </div>

              <div style={{ borderLeft: '1px solid rgba(201,168,76,0.2)', paddingLeft: '2rem', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                  <h2 style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: 'var(--cream)',
                    margin: 0,
                  }}>
                    {p.name}
                  </h2>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '0.65rem',
                    color: 'var(--gold)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}>
                    {p.years}
                  </span>
                </div>
                <p style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: '0.9rem',
                  color: 'var(--text-muted)',
                  margin: 0,
                  fontWeight: 300,
                  lineHeight: 1.6,
                }}>
                  {p.description}
                </p>
              </div>

              <div style={{
                color: 'var(--gold)',
                fontSize: '1.25rem',
                flexShrink: 0,
                opacity: 0.6,
              }}>→</div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
