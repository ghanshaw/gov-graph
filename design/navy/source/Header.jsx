import { Link, useLocation } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Presidents' },
  { to: '/executive-orders', label: 'Executive Orders' },
  { to: '/supreme-court', label: 'Supreme Court' },
  { to: '/congress', label: 'Congress' },
  { to: '/timeline', label: 'Timeline' },
  { to: '/corpus', label: 'Corpus' },
  { to: '/case-graph', label: 'Case Graph' },
  { to: '/sources', label: 'Sources' },
  { to: '/tags', label: 'Tags' },
];

export default function Header() {
  const { pathname } = useLocation();

  return (
    <header style={{
      borderBottom: '1px solid rgba(201,168,76,0.25)',
      background: 'rgba(10,22,40,0.95)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 2rem',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: '2px solid var(--gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            color: 'var(--gold)',
            fontFamily: "'IBM Plex Mono', monospace",
            fontWeight: 500,
            flexShrink: 0,
          }}>★</div>
          <div>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.1rem',
              fontWeight: 700,
              color: 'var(--cream)',
              letterSpacing: '0.02em',
              lineHeight: 1.1,
            }}>
              GovLens
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.65rem',
              color: 'var(--gold)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}>
              Public Records
            </div>
          </div>
        </Link>

        <nav style={{ display: 'flex', gap: '0.25rem' }}>
          {NAV.map(({ to, label }) => {
            const active = to === '/'
              ? !pathname.startsWith('/supreme-court') && !pathname.startsWith('/timeline') && !pathname.startsWith('/congress') && !pathname.startsWith('/corpus') && !pathname.startsWith('/case-graph') && !pathname.startsWith('/sources') && !pathname.startsWith('/tags') && !pathname.startsWith('/executive-orders')
              : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '0.7rem',
                  letterSpacing: '0.08em',
                  textDecoration: 'none',
                  padding: '6px 14px',
                  borderRadius: '3px',
                  background: active ? 'rgba(201,168,76,0.12)' : 'transparent',
                  color: active ? 'var(--gold)' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--cream)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
