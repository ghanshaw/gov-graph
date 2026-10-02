import { Link } from 'react-router-dom';

export default function TimelineView({ orders, slug, docType, newestFirst = false }) {
  const byYear = orders.reduce((acc, order) => {
    const y = order.year || 'Unknown';
    if (!acc[y]) acc[y] = [];
    acc[y].push(order);
    return acc;
  }, {});

  // Orders arrive already sorted; the year groups follow the same direction.
  const years = Object.keys(byYear).sort((a, b) => (newestFirst ? b - a : a - b));

  return (
    <div style={{ position: 'relative', paddingLeft: '2rem' }}>
      {/* vertical line */}
      <div style={{
        position: 'absolute',
        left: '7px',
        top: 0,
        bottom: 0,
        width: '2px',
        background: 'linear-gradient(to bottom, rgba(201,168,76,0.6), rgba(201,168,76,0.05))',
      }} />

      {years.map(year => (
        <div key={year} style={{ marginBottom: '3rem' }}>
          {/* Year marker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{
              position: 'absolute',
              left: 0,
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: 'var(--gold)',
              border: '3px solid var(--navy)',
              boxShadow: '0 0 0 2px var(--gold)',
            }} />
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.6rem',
              fontWeight: 700,
              color: 'var(--gold)',
              margin: 0,
              letterSpacing: '-0.01em',
            }}>
              {year}
            </h2>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              letterSpacing: '0.08em',
            }}>
              {byYear[year].length} order{byYear[year].length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Orders for this year */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {byYear[year].map(order => (
              <Link
                key={order.number || order.title}
                to={`/${slug}/${docType}/eo/${order.number}`}
                style={{ textDecoration: 'none' }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '1rem',
                  padding: '0.875rem 1.25rem',
                  background: 'rgba(17,32,64,0.5)',
                  border: '1px solid rgba(201,168,76,0.1)',
                  borderRadius: '4px',
                  transition: 'border-color 0.15s, background 0.15s',
                  position: 'relative',
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)';
                    e.currentTarget.style.background = 'rgba(17,32,64,0.8)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(201,168,76,0.1)';
                    e.currentTarget.style.background = 'rgba(17,32,64,0.5)';
                  }}
                >
                  {/* dot on the line */}
                  <div style={{
                    position: 'absolute',
                    left: '-1.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: 'rgba(201,168,76,0.5)',
                  }} />

                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '0.65rem',
                    color: 'var(--gold)',
                    letterSpacing: '0.06em',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}>
                    EO {order.number}
                  </span>

                  <span style={{
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    fontSize: '0.95rem',
                    color: 'var(--cream)',
                    fontWeight: 400,
                    lineHeight: 1.4,
                  }}>
                    {order.title}
                  </span>

                  {order.dateSigned && (
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: '0.6rem',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      marginLeft: 'auto',
                    }}>
                      {new Date(order.dateSigned + 'T00:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
