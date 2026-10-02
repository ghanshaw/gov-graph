import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_EXECUTIVE_ORDERS } from '../queries';
import ExecutiveOrderCard from '../components/ExecutiveOrderCard';
import Pagination from '../components/Pagination';
import TimelineView from '../components/TimelineView';

const PER_PAGE = 20;

const PRESIDENT_META = {
  'barack-obama':  { name: 'Barack Obama',  years: [2009,2010,2011,2012,2013,2014,2015,2016,2017] },
  'donald-trump':    { name: 'Donald Trump', years: [2017,2018,2019,2020,2021] },
  'donald-trump-47': { name: 'Donald Trump', years: [2025,2026] },
  'joseph-biden':  { name: 'Joe Biden',     years: [2021,2022,2023,2024,2025] },
};

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  const timeoutRef = useState(null);

  const update = useCallback((val) => {
    if (timeoutRef[0]) clearTimeout(timeoutRef[0]);
    timeoutRef[0] = setTimeout(() => setDebounced(val), delay);
  }, [delay]);

  return [debounced, update];
}

const DOC_TYPE_META = {
  'executive-orders': { apiKey: 'executive_order',      label: 'Executive Orders' },
  'memoranda':        { apiKey: 'memorandum',              label: 'Presidential Memoranda' },
};

export default function Home() {
  const { slug, docType } = useParams();
  const meta = PRESIDENT_META[slug] || { name: slug, years: [] };
  const docMeta = DOC_TYPE_META[docType] || DOC_TYPE_META['executive-orders'];
  const YEARS = ['All Years', ...meta.years];
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useDebounce('', 400);
  const [year, setYear] = useState(null);
  const [view, setView] = useState('grid');

  const handleSearch = (val) => {
    setSearchInput(val);
    setDebouncedSearch(val);
    setPage(1);
  };

  const handleYear = (val) => {
    setYear(val === 'All Years' ? null : val);
    setPage(1);
  };

  const isTimeline = view === 'timeline';

  const { data, loading, error } = useQuery(GET_EXECUTIVE_ORDERS, {
    variables: {
      president: slug,
      documentType: docMeta.apiKey,
      page: isTimeline ? 1 : page,
      perPage: isTimeline ? 500 : PER_PAGE,
      search: debouncedSearch || undefined,
      year: year || undefined,
    },
  });

  const orders = data?.executiveOrders?.orders || [];
  const totalCount = data?.executiveOrders?.totalCount || 0;
  const totalPages = data?.executiveOrders?.totalPages || 1;

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '3rem 2rem' }}>

      {/* Hero */}
      <div style={{ marginBottom: '3rem' }}>
        <Link to={`/${slug}`} style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          textDecoration: 'none',
          letterSpacing: '0.08em',
          marginBottom: '1.5rem',
          transition: 'color 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--gold)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          ← {meta.name}
        </Link>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.7rem',
          color: 'var(--gold)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginBottom: '0.75rem',
        }}>
          {meta.name} · Federal Register
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem' }}>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          fontWeight: 900,
          color: 'var(--cream)',
          margin: '0 0 1rem 0',
          lineHeight: 1.1,
          letterSpacing: '-0.01em',
        }}>
          {docMeta.label}
        </h1>
        {!loading && totalCount > 0 && (
          <div style={{ textAlign: 'right', flexShrink: 0, marginBottom: '1rem' }}>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
              fontWeight: 900,
              color: 'var(--gold)',
              lineHeight: 1,
            }}>
              {totalCount.toLocaleString()}
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.6rem',
              color: 'var(--text-muted)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginTop: '0.25rem',
            }}>
              Total
            </div>
          </div>
        )}
        </div>
        <p style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: '1rem',
          color: 'var(--text-muted)',
          margin: 0,
          maxWidth: '560px',
          lineHeight: 1.7,
          fontWeight: 300,
        }}>
          A complete record of every executive order issued by President {meta.name}, sourced from the Federal Register.
        </p>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        {/* Search */}
        <div style={{ flex: '1', minWidth: '260px', position: 'relative' }}>
          <span style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            pointerEvents: 'none',
          }}>⌕</span>
          <input
            type="text"
            placeholder="Search executive orders…"
            value={searchInput}
            onChange={e => handleSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 36px',
              background: 'rgba(17,32,64,0.8)',
              border: '1px solid rgba(201,168,76,0.25)',
              borderRadius: '4px',
              color: 'var(--cream)',
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: '0.875rem',
              outline: 'none',
              transition: 'border 0.2s',
            }}
            onFocus={e => e.target.style.border = '1px solid rgba(201,168,76,0.6)'}
            onBlur={e => e.target.style.border = '1px solid rgba(201,168,76,0.25)'}
          />
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', gap: '0', border: '1px solid rgba(201,168,76,0.25)', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}>
          {['grid', 'timeline'].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.7rem',
                padding: '6px 14px',
                border: 'none',
                background: view === v ? 'var(--gold)' : 'transparent',
                color: view === v ? 'var(--navy)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontWeight: view === v ? 600 : 400,
                letterSpacing: '0.05em',
                transition: 'all 0.15s',
                textTransform: 'uppercase',
              }}
            >
              {v === 'grid' ? '⊞ Grid' : '≡ Timeline'}
            </button>
          ))}
        </div>

        {/* Year filter */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {YEARS.map(y => {
            const isActive = (y === 'All Years' && !year) || y === year;
            return (
              <button
                key={y}
                onClick={() => handleYear(y)}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '0.7rem',
                  padding: '6px 12px',
                  border: isActive ? '1px solid var(--gold)' : '1px solid rgba(201,168,76,0.25)',
                  borderRadius: '3px',
                  background: isActive ? 'var(--gold)' : 'transparent',
                  color: isActive ? 'var(--navy)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.15s ease',
                  letterSpacing: '0.05em',
                }}
              >
                {y}
              </button>
            );
          })}
        </div>
      </div>

      {/* Result count */}
      {!loading && !error && (
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          marginBottom: '1.5rem',
          letterSpacing: '0.05em',
        }}>
          {totalCount.toLocaleString()} found
          {debouncedSearch && ` matching "${debouncedSearch}"`}
          {year && ` in ${year}`}
        </div>
      )}

      {/* States */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '6rem 0', color: 'var(--text-muted)' }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
            animation: 'pulse 1.5s infinite',
          }}>
            Loading records…
          </div>
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(192,57,43,0.1)',
          border: '1px solid rgba(192,57,43,0.4)',
          borderRadius: '4px',
          padding: '1.5rem',
          color: '#e88',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.8rem',
        }}>
          Failed to load data: {error.message}
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          {orders.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '5rem 0',
              color: 'var(--text-muted)',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.8rem',
            }}>
              No executive orders found.
            </div>
          ) : isTimeline ? (
            <TimelineView orders={orders} slug={slug} docType={docType} />
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))',
              gap: '1rem',
            }}>
              {orders.map(order => (
                <ExecutiveOrderCard key={order.number || order.title} order={order} slug={slug} docType={docType} />
              ))}
            </div>
          )}

          {!isTimeline && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            />
          )}
        </>
      )}
    </main>
  );
}
