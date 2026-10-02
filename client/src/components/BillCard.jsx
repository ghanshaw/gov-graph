import { Link } from 'react-router-dom';

const TYPE_CODE = {
  HR: 'H.R.', S: 'S.', HJRES: 'H.J.Res.', SJRES: 'S.J.Res.',
  HCONRES: 'H.Con.Res.', SCONRES: 'S.Con.Res.', HRES: 'H.Res.', SRES: 'S.Res.',
};

const TYPE_FULL = {
  HR: 'House Bill',
  S: 'Senate Bill',
  HJRES: 'House Joint Resolution',
  SJRES: 'Senate Joint Resolution',
  HCONRES: 'House Concurrent Resolution',
  SCONRES: 'Senate Concurrent Resolution',
  HRES: 'House Resolution',
  SRES: 'Senate Resolution',
};

const PARTY_COLOR = { D: '#93c5fd', R: '#fca5a5', I: '#86efac' };

export default function BillCard({ bill }) {
  const typeCode = TYPE_CODE[bill.type] || bill.type;
  const typeFull = TYPE_FULL[bill.type] || bill.type;

  const formattedDate = bill.introducedDate
    ? new Date(bill.introducedDate + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : null;

  const truncatedAction = bill.latestActionText && bill.latestActionText.length > 120
    ? bill.latestActionText.slice(0, 120) + '…'
    : bill.latestActionText;

  return (
    <Link
      to={`/congress/${bill.congress}/${bill.type.toLowerCase()}/${bill.number}`}
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
            <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.7rem',
                color: 'var(--gold)',
                letterSpacing: '0.08em',
              }}>
                {typeFull} {bill.number}
              </span>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.6rem',
                color: 'rgba(201,168,76,0.4)',
                letterSpacing: '0.05em',
              }}>
                {typeCode} {bill.number}
              </span>
              {bill.policyArea && (
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '0.6rem',
                  color: 'var(--text-muted)',
                  background: 'rgba(201,168,76,0.06)',
                  border: '1px solid rgba(201,168,76,0.15)',
                  borderRadius: '2px',
                  padding: '1px 6px',
                  letterSpacing: '0.03em',
                }}>
                  {bill.policyArea}
                </span>
              )}
            </div>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--cream)',
              margin: '0 0 0.6rem 0',
              lineHeight: 1.35,
            }}>
              {bill.title || 'Untitled Bill'}
            </h2>
            {bill.sponsor && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  fontWeight: 300,
                }}>
                  {bill.sponsor.fullName}
                </span>
                {bill.sponsor.party && (
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '0.6rem',
                    color: PARTY_COLOR[bill.sponsor.party] || 'var(--text-muted)',
                    letterSpacing: '0.05em',
                  }}>
                    ({bill.sponsor.party}-{bill.sponsor.state})
                  </span>
                )}
              </div>
            )}
            {truncatedAction && (
              <div style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: '0.5rem',
                fontWeight: 300,
                lineHeight: 1.4,
                opacity: 0.8,
              }}>
                {truncatedAction}
              </div>
            )}
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            {formattedDate && (
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}>
                {formattedDate}
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
