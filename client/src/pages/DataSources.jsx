const BRANCHES = [
  {
    label: 'Executive Branch',
    accentColor: '#c9a84c',
    sources: [
      {
        name: 'Federal Register API',
        url: 'https://www.federalregister.gov/api/v1',
        displayUrl: 'federalregister.gov/api/v1',
        docTypes: ['Executive Orders', 'Memoranda', 'Proclamations', 'Notices', 'Rules'],
        auth: { label: 'No auth required', type: 'open' },
      },
    ],
  },
  {
    label: 'Judicial Branch',
    accentColor: '#818cf8',
    sources: [
      {
        name: 'CourtListener API',
        url: 'https://www.courtlistener.com/api/rest/v4',
        displayUrl: 'courtlistener.com/api/rest/v4',
        docTypes: ['Opinions', 'Dissents', 'Concurrences', 'Case Clusters'],
        auth: { label: 'Free token required', type: 'token', envVar: 'COURTLISTENER_TOKEN' },
      },
    ],
  },
  {
    label: 'Legislative Branch',
    accentColor: '#34d399',
    sources: [
      {
        name: 'Congress.gov API',
        url: 'https://api.congress.gov/v3',
        displayUrl: 'api.congress.gov/v3',
        docTypes: ['Bills', 'Laws', 'Resolutions', 'Actions', 'Full Text'],
        auth: { label: 'API key required', type: 'key', envVar: 'CONGRESS_API_KEY' },
      },
    ],
  },
];

const AUTH_COLORS = {
  open:  { bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.25)',  dot: '#4ade80',  text: '#6ee7b7' },
  token: { bg: 'rgba(244,63,94,0.08)',   border: 'rgba(244,63,94,0.25)',   dot: '#f43f5e',  text: '#fda4af' },
  key:   { bg: 'rgba(201,168,76,0.08)',  border: 'rgba(201,168,76,0.25)',  dot: '#c9a84c',  text: '#fde68a' },
};

export default function DataSources() {
  return (
    <main style={{ maxWidth: '960px', margin: '0 auto', padding: '5rem 2rem' }}>

      {/* Page header */}
      <div style={{ marginBottom: '4rem' }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.7rem',
          color: 'var(--gold)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginBottom: '0.75rem',
        }}>
          GovLens · Data Infrastructure
        </div>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 'clamp(2rem, 5vw, 3rem)',
          fontWeight: 900,
          color: 'var(--cream)',
          margin: '0 0 1rem 0',
          lineHeight: 1.1,
          letterSpacing: '-0.01em',
        }}>
          Data Sources
        </h1>
        <p style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: '1rem',
          color: 'var(--text-muted)',
          maxWidth: '520px',
          lineHeight: 1.7,
        }}>
          Every document in GovLens is fetched from a primary government or court API.
          No intermediaries — the data comes straight from the source.
        </p>
      </div>

      {/* Branch sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
        {BRANCHES.map(branch => (
          <section key={branch.label}>
            {/* Branch label */}
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: branch.accentColor,
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <span style={{
                display: 'inline-block',
                width: '24px',
                height: '1px',
                background: branch.accentColor,
                opacity: 0.5,
              }} />
              {branch.label}
            </div>

            {/* Source cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {branch.sources.map(src => {
                const authStyle = AUTH_COLORS[src.auth.type];
                return (
                  <div
                    key={src.name}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderLeft: `3px solid ${branch.accentColor}`,
                      borderRadius: '6px',
                      padding: '22px 24px',
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: '20px',
                      alignItems: 'start',
                    }}
                  >
                    {/* Left: name + url + doc types */}
                    <div>
                      <div style={{
                        fontFamily: "'IBM Plex Sans', sans-serif",
                        fontSize: '1.05rem',
                        fontWeight: 600,
                        color: 'var(--cream)',
                        marginBottom: '4px',
                      }}>
                        {src.name}
                      </div>
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: '0.75rem',
                          color: branch.accentColor,
                          opacity: 0.8,
                          textDecoration: 'none',
                          display: 'inline-block',
                          marginBottom: '14px',
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
                      >
                        {src.displayUrl} ↗
                      </a>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {src.docTypes.map(dt => (
                          <span
                            key={dt}
                            style={{
                              fontFamily: "'IBM Plex Mono', monospace",
                              fontSize: '0.68rem',
                              padding: '3px 10px',
                              borderRadius: '3px',
                              background: `${branch.accentColor}12`,
                              border: `1px solid ${branch.accentColor}30`,
                              color: branch.accentColor,
                              opacity: 0.9,
                            }}
                          >
                            {dt}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Right: auth badge */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '6px',
                    }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '7px',
                        padding: '5px 12px',
                        borderRadius: '4px',
                        background: authStyle.bg,
                        border: `1px solid ${authStyle.border}`,
                        whiteSpace: 'nowrap',
                      }}>
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: authStyle.dot,
                          flexShrink: 0,
                        }} />
                        <span style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: '0.68rem',
                          color: authStyle.text,
                        }}>
                          {src.auth.label}
                        </span>
                      </div>
                      {src.auth.envVar && (
                        <span style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: '0.63rem',
                          color: 'var(--text-muted)',
                          opacity: 0.6,
                        }}>
                          {src.auth.envVar}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Internal DB section */}
      <section style={{ marginTop: '56px' }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.65rem',
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span style={{
            display: 'inline-block',
            width: '24px',
            height: '1px',
            background: 'var(--text-muted)',
            opacity: 0.4,
          }} />
          Internal Database
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderLeft: '3px solid rgba(100,116,139,0.6)',
          borderRadius: '6px',
          padding: '22px 24px',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '20px',
          alignItems: 'start',
        }}>
          <div>
            <div style={{
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: '1.05rem',
              fontWeight: 600,
              color: 'var(--cream)',
              marginBottom: '4px',
            }}>
              Supabase / PostgreSQL
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginBottom: '14px',
            }}>
              Self-hosted Postgres via Supabase
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {['documents', 'document_relationships'].map(t => (
                <span key={t} style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '0.68rem',
                  padding: '3px 10px',
                  borderRadius: '3px',
                  background: 'rgba(100,116,139,0.1)',
                  border: '1px solid rgba(100,116,139,0.25)',
                  color: '#94a3b8',
                }}>
                  {t}
                </span>
              ))}
            </div>
            <div style={{
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              lineHeight: 1.6,
              maxWidth: '460px',
            }}>
              Stores the citation graph — document nodes and typed edges
              (cites · revokes · amends · supersedes). Powers the Case Graph view.
            </div>
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            padding: '5px 12px',
            borderRadius: '4px',
            background: 'rgba(244,63,94,0.08)',
            border: '1px solid rgba(244,63,94,0.25)',
            whiteSpace: 'nowrap',
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f43f5e' }} />
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.68rem',
              color: '#fda4af',
            }}>
              Connection string required
            </span>
          </div>
        </div>
      </section>

    </main>
  );
}
