import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_EXECUTIVE_ORDERS } from '../queries';

const PRESIDENT_META = {
  'barack-obama': { name: 'Barack Obama', ordinal: '44th', years: '2009 – 2017' },
  'donald-trump':    { name: 'Donald Trump', ordinal: '45th', years: '2017 – 2021' },
  'donald-trump-47': { name: 'Donald Trump', ordinal: '47th', years: '2025 – present' },
  'joseph-biden': { name: 'Joe Biden',    ordinal: '46th', years: '2021 – 2025' },
};

const DOCUMENT_TYPES = [
  {
    key: 'executive-orders',
    label: 'Executive Orders',
    description: 'Directives issued by the President that manage operations of the federal government.',
  },
  {
    key: 'memoranda',
    label: 'Presidential Memoranda',
    description: 'Official communications used to direct actions of executive branch departments and agencies.',
  },
];

function useCount(president, documentType) {
  const { data } = useQuery(GET_EXECUTIVE_ORDERS, {
    variables: { president, documentType, page: 1, perPage: 1 },
  });
  return data?.executiveOrders?.totalCount ?? null;
}

export default function President() {
  const { slug } = useParams();
  const meta = PRESIDENT_META[slug] || { name: slug, ordinal: '', years: '' };
  const eoCount = useCount(slug, 'executive_order');
  const memoCount = useCount(slug, 'memorandum');
  const counts = { 'executive-orders': eoCount, memoranda: memoCount };

  return (
    <main style={{ maxWidth: '820px', margin: '0 auto', padding: '5rem 2rem' }}>
      <Link to="/" style={{
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
        ← All Presidents
      </Link>

      <div style={{ marginBottom: '4rem' }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.7rem',
          color: 'var(--gold)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginBottom: '0.5rem',
        }}>
          {meta.ordinal} President · {meta.years}
        </div>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 'clamp(2rem, 5vw, 3rem)',
          fontWeight: 900,
          color: 'var(--cream)',
          margin: 0,
          lineHeight: 1.1,
        }}>
          {meta.name}
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {DOCUMENT_TYPES.map(dt => (
          <Link key={dt.key} to={`/${slug}/${dt.key}`} style={{ textDecoration: 'none' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2rem',
                padding: '1.75rem 2rem',
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
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.35rem' }}>
                  <div style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: 'var(--cream)',
                  }}>
                    {dt.label}
                  </div>
                  {counts[dt.key] !== null && (
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: '0.65rem',
                      color: 'var(--gold)',
                      letterSpacing: '0.06em',
                    }}>
                      {counts[dt.key].toLocaleString()}
                    </span>
                  )}
                </div>
                <div style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: '0.875rem',
                  color: 'var(--text-muted)',
                  fontWeight: 300,
                  lineHeight: 1.5,
                }}>
                  {dt.description}
                </div>
              </div>
              <div style={{ color: 'var(--gold)', fontSize: '1.25rem', opacity: 0.6, flexShrink: 0 }}>→</div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
