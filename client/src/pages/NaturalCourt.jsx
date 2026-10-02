import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_SCOTUS_CASES, GET_NATURAL_COURTS } from '../queries';
import CaseCard from '../components/CaseCard';
import Pagination from '../components/Pagination';

const PER_PAGE = 20;

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  const timeoutRef = useState(null);
  const update = useCallback((val) => {
    if (timeoutRef[0]) clearTimeout(timeoutRef[0]);
    timeoutRef[0] = setTimeout(() => setDebounced(val), delay);
  }, [delay]);
  return [debounced, update];
}

export default function NaturalCourt() {
  const { courtSlug } = useParams();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useDebounce('', 400);
  const [orderBy, setOrderBy] = useState('dateFiled asc');
  const [selectedYear, setSelectedYear] = useState(null);

  const { data: courtsData } = useQuery(GET_NATURAL_COURTS);
  const court = courtsData?.naturalCourts?.find(c => c.slug === courtSlug);

  const handleSearch = (val) => {
    setSearchInput(val);
    setDebouncedSearch(val);
    setPage(1);
  };

  const handleOrderBy = (val) => {
    setOrderBy(val);
    setPage(1);
  };

  const handleYear = (year) => {
    setSelectedYear(prev => prev === year ? null : year);
    setPage(1);
  };

  const courtYears = court ? (() => {
    const start = parseInt(court.startDate.split('-')[0]);
    const end = court.endDate ? parseInt(court.endDate.split('-')[0]) : new Date().getFullYear();
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  })() : [];

  const { data, loading, error } = useQuery(GET_SCOTUS_CASES, {
    variables: {
      courtSlug,
      page,
      perPage: PER_PAGE,
      search: debouncedSearch || undefined,
      orderBy,
      year: selectedYear || undefined,
    },
    fetchPolicy: 'network-only',
  });

  const cases = data?.scotusCases?.cases || [];
  const totalCount = data?.scotusCases?.totalCount || 0;
  const totalPages = data?.scotusCases?.totalPages || 1;

  const formatYear = d => d ? new Date(d + 'T00:00:00').getFullYear() : '';
  const dateRange = court
    ? `${formatYear(court.startDate)} – ${court.endDate ? formatYear(court.endDate) : 'Present'}`
    : '';

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '3rem 2rem' }}>
      <div style={{ marginBottom: '3rem' }}>
        <Link to="/supreme-court" style={{
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
          ← Natural Courts
        </Link>

        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.7rem',
          color: 'var(--gold)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginBottom: '0.75rem',
        }}>
          Supreme Court · {dateRange}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem' }}>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 900,
            color: 'var(--cream)',
            margin: '0 0 1rem 0',
            lineHeight: 1.1,
          }}>
            {court?.name || courtSlug}
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

        {court?.justices && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1rem' }}>
            {court.justices.map(j => (
              <span key={j} style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.6rem',
                color: 'var(--text-muted)',
                background: 'rgba(201,168,76,0.06)',
                border: '1px solid rgba(201,168,76,0.15)',
                borderRadius: '2px',
                padding: '2px 8px',
                letterSpacing: '0.03em',
              }}>
                {j}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Search + Sort */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ position: 'relative', maxWidth: '480px' }}>
          <span style={{
            position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', fontSize: '0.85rem', pointerEvents: 'none',
          }}>⌕</span>
          <input
            type="text"
            placeholder="Search cases…"
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
              boxSizing: 'border-box',
            }}
            onFocus={e => e.target.style.border = '1px solid rgba(201,168,76,0.6)'}
            onBlur={e => e.target.style.border = '1px solid rgba(201,168,76,0.25)'}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          {[
            { value: 'dateFiled asc', label: 'Date ↑' },
            { value: 'dateFiled desc', label: 'Date ↓' },
            { value: 'citeCount desc', label: 'Most Cited' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => handleOrderBy(opt.value)}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.65rem',
                letterSpacing: '0.08em',
                padding: '4px 12px',
                borderRadius: '3px',
                border: '1px solid',
                cursor: 'pointer',
                transition: 'all 0.15s',
                borderColor: orderBy === opt.value ? 'var(--gold)' : 'rgba(201,168,76,0.25)',
                background: orderBy === opt.value ? 'var(--gold)' : 'transparent',
                color: orderBy === opt.value ? 'var(--navy)' : 'var(--text-muted)',
                fontWeight: orderBy === opt.value ? 600 : 400,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {courtYears.length > 0 && (
          <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            {courtYears.map(year => (
              <button
                key={year}
                onClick={() => handleYear(year)}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '0.65rem',
                  letterSpacing: '0.08em',
                  padding: '4px 10px',
                  borderRadius: '3px',
                  border: '1px solid',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  borderColor: selectedYear === year ? 'var(--gold)' : 'rgba(201,168,76,0.25)',
                  background: selectedYear === year ? 'var(--gold)' : 'transparent',
                  color: selectedYear === year ? 'var(--navy)' : 'var(--text-muted)',
                  fontWeight: selectedYear === year ? 600 : 400,
                }}
              >
                {year}
              </button>
            ))}
          </div>
        )}
      </div>

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
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '6rem 0', color: 'var(--text-muted)' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem', letterSpacing: '0.1em' }}>
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

      {!loading && !error && (
        <>
          {cases.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '5rem 0',
              color: 'var(--text-muted)',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.8rem',
            }}>
              No cases found.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))',
              gap: '1rem',
            }}>
              {cases.map(c => (
                <CaseCard key={c.id} scotusCase={c} courtSlug={courtSlug} />
              ))}
            </div>
          )}

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
