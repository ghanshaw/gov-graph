import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_EXECUTIVE_ORDERS } from '../queries';
import ExecutiveOrderCard from '../components/ExecutiveOrderCard';
import Pagination from '../components/Pagination';

const PER_PAGE = 20;

const YEARS = ['All Years', ...Array.from({ length: new Date().getFullYear() - 2008 }, (_, i) => 2009 + i).reverse()];

const PRESIDENTS = [
  { label: 'All', value: null },
  { label: 'Obama', value: 'barack-obama' },
  { label: 'Trump (45th)', value: 'donald-trump' },
  { label: 'Biden', value: 'joseph-biden' },
  { label: 'Trump (47th)', value: 'donald-trump-47' },
];

const SORTS = [
  { label: 'Newest first', value: 'newest' },
  { label: 'Oldest first', value: 'oldest' },
];

// Map app slug → Federal Register API slug for the query variable
const SLUG_TO_API = {
  'barack-obama': 'barack-obama',
  'donald-trump': 'donald-trump',
  'donald-trump-47': 'donald-trump-47',
  'joseph-biden': 'joseph-biden',
};

// Map API president identifier → app slug (for card links)
// donald-trump API identifier could be either term; we use signing date to disambiguate in the card
const API_TO_SLUG = {
  'donald-trump': 'donald-trump', // default to 45th; card link resolves by year
  'joe-biden': 'joseph-biden',
  'barack-obama': 'barack-obama',
};

function deriveSlug(order) {
  if (!order.president) return 'donald-trump';
  const slug = API_TO_SLUG[order.president] || order.president;
  // Disambiguate Trump terms by year
  if (order.president === 'donald-trump' && order.year && order.year >= 2025) {
    return 'donald-trump-47';
  }
  return slug;
}

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  const timeoutRef = useState(null);

  const update = useCallback((val) => {
    if (timeoutRef[0]) clearTimeout(timeoutRef[0]);
    timeoutRef[0] = setTimeout(() => setDebounced(val), delay);
  }, [delay]);

  return [debounced, update];
}

export default function ExecutiveOrders() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useDebounce('', 400);
  const [year, setYear] = useState(null);
  const [president, setPresident] = useState(null);
  const [sort, setSort] = useState('newest');

  const handleSearch = (val) => {
    setSearchInput(val);
    setDebouncedSearch(val);
    setPage(1);
  };

  const handleYear = (val) => {
    setYear(val === 'All Years' ? null : val);
    setPage(1);
  };

  const handlePresident = (val) => {
    setPresident(val);
    setPage(1);
  };

  const handleSort = (val) => {
    setSort(val);
    setPage(1);
  };

  const { data, loading, error } = useQuery(GET_EXECUTIVE_ORDERS, {
    variables: {
      president: president || undefined,
      documentType: 'executive_order',
      page,
      perPage: PER_PAGE,
      search: debouncedSearch || undefined,
      year: year || undefined,
      order: sort,
    },
  });

  const orders = data?.executiveOrders?.orders || [];
  const totalCount = data?.executiveOrders?.totalCount || 0;
  const totalPages = data?.executiveOrders?.totalPages || 1;

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '3rem 2rem' }}>

      {/* Hero */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.7rem',
          color: 'var(--gold)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginBottom: '0.75rem',
        }}>
          Federal Register · All Administrations
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
            Executive Orders
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
                {debouncedSearch || year || president ? 'Results' : 'Total'}
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
          Search executive orders across all administrations, sourced from the Federal Register.
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>

        {/* Search */}
        <div style={{ position: 'relative' }}>
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
            placeholder="Search across all executive orders…"
            value={searchInput}
            autoFocus
            onChange={e => handleSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px 12px 36px',
              background: 'rgba(17,32,64,0.8)',
              border: '1px solid rgba(201,168,76,0.25)',
              borderRadius: '4px',
              color: 'var(--cream)',
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: '1rem',
              outline: 'none',
              transition: 'border 0.2s',
              boxSizing: 'border-box',
            }}
            onFocus={e => e.target.style.border = '1px solid rgba(201,168,76,0.6)'}
            onBlur={e => e.target.style.border = '1px solid rgba(201,168,76,0.25)'}
          />
        </div>

        {/* President filter */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginRight: '0.25rem',
          }}>President</span>
          {PRESIDENTS.map(p => {
            const isActive = president === p.value;
            return (
              <button
                key={p.label}
                onClick={() => handlePresident(p.value)}
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
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Year filter */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginRight: '0.25rem',
          }}>Year</span>
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

      {/* Result count and sort */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap',
        minHeight: '2rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          letterSpacing: '0.05em',
        }}>
          {!loading && !error && (
            <>
              {totalCount.toLocaleString()} found
              {debouncedSearch && ` matching "${debouncedSearch}"`}
              {year && ` in ${year}`}
              {president && ` · ${PRESIDENTS.find(p => p.value === president)?.label}`}
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginRight: '0.25rem',
          }}>Sort</span>
          {SORTS.map(s => {
            const isActive = sort === s.value;
            return (
              <button
                key={s.value}
                onClick={() => handleSort(s.value)}
                aria-pressed={isActive}
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
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* States */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '6rem 0', color: 'var(--text-muted)' }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
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

      {/* Results */}
      {!loading && !error && orders.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '5rem 0',
          color: 'var(--text-muted)',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.8rem',
        }}>
          {debouncedSearch || year || president
            ? 'No executive orders match your filters.'
            : 'Enter a search term or select a filter to browse executive orders.'}
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))',
            gridAutoRows: '1fr',
            gap: '1rem',
          }}>
            {orders.map(order => {
              const slug = deriveSlug(order);
              return (
                <ExecutiveOrderCard
                  key={order.number || order.title}
                  order={order}
                  slug={slug}
                  docType="executive-orders"
                  showPresident
                />
              );
            })}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
        </>
      )}
    </main>
  );
}
