import { Link } from 'react-router-dom';

const DIRECTION_LABEL = {
  'liberal': 'Liberal',
  'conservative': 'Conservative',
  'unspecifiable': null,
};

export default function CaseCard({ scotusCase, courtSlug }) {
  const formattedDate = scotusCase.dateFiled
    ? new Date(scotusCase.dateFiled + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : 'Date unknown';

  const voteDisplay = scotusCase.votesMajority != null && scotusCase.votesMinority != null
    ? `${scotusCase.votesMajority}–${scotusCase.votesMinority}`
    : null;

  const direction = DIRECTION_LABEL[scotusCase.decisionDirection] || null;

  return (
    <Link
      to={`/supreme-court/${courtSlug}/${scotusCase.id}`}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <article
        style={{
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
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px',
          background: 'linear-gradient(to bottom, var(--gold), transparent)',
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            {(scotusCase.citation || scotusCase.docketNumber) && (
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                {scotusCase.citation && (
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '0.7rem',
                    color: 'var(--gold)',
                    letterSpacing: '0.1em',
                  }}>
                    {scotusCase.citation}
                  </span>
                )}
                {scotusCase.docketNumber && (
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.1em',
                  }}>
                    No. {scotusCase.docketNumber}
                  </span>
                )}
              </div>
            )}
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.05rem',
              fontWeight: 600,
              color: 'var(--cream)',
              margin: 0,
              lineHeight: 1.35,
            }}>
              {scotusCase.caseName}
            </h2>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
            }}>
              {formattedDate}
            </div>
            {voteDisplay && (
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--gold)',
                marginTop: '0.3rem',
              }}>
                {voteDisplay}
                {direction && (
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.4rem' }}>
                    {direction}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{
          position: 'absolute', right: '1.5rem', bottom: '1.25rem',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.7rem', color: 'var(--gold)', opacity: 0.6,
        }}>→</div>
      </article>
    </Link>
  );
}
