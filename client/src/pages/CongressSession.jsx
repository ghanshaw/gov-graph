import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_BILLS, GET_LAWS, GET_CONGRESSES } from '../queries';
import BillCard from '../components/BillCard';
import Pagination from '../components/Pagination';

const PER_PAGE = 20;

const BILL_TYPES = [
  { value: null, label: 'All' },
  { value: 'HR', label: 'House Bill' },
  { value: 'S', label: 'Senate Bill' },
  { value: 'HJRES', label: 'House Joint Resolution' },
  { value: 'SJRES', label: 'Senate Joint Resolution' },
];

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  const timeoutRef = useState(null);
  const update = useCallback((val) => {
    if (timeoutRef[0]) clearTimeout(timeoutRef[0]);
    timeoutRef[0] = setTimeout(() => setDebounced(val), delay);
  }, [delay]);
  return [debounced, update];
}

export default function CongressSession() {
  const { number } = useParams();
  const congressNum = parseInt(number);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useDebounce('', 400);
  const [billType, setBillType] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [enactedOnly, setEnactedOnly] = useState(false);

  const { data: congressesData } = useQuery(GET_CONGRESSES);
  const congress = congressesData?.congresses?.find(c => c.number === congressNum);

  const congressYears = congress
    ? Array.from({ length: congress.endYear - congress.startYear + 1 }, (_, i) => congress.startYear + i)
    : [];

  const handleSearch = (val) => {
    setSearchInput(val);
    setDebouncedSearch(val);
    setPage(1);
  };

  const handleBillType = (val) => {
    setBillType(val);
    setPage(1);
  };

  const handleEnacted = () => {
    setEnactedOnly(e => !e);
    setPage(1);
  };

  const handleYear = (year) => {
    setSelectedYear(prev => prev === year ? null : year);
    setPage(1);
  };

  const { data: billsData, loading: billsLoading, error: billsError } = useQuery(GET_BILLS, {
    variables: {
      congress: congressNum,
      billType: billType || undefined,
      page,
      perPage: PER_PAGE,
      search: debouncedSearch || undefined,
      year: selectedYear || undefined,
    },
    fetchPolicy: 'network-only',
    skip: enactedOnly,
  });

  const { data: lawsData, loading: lawsLoading, error: lawsError } = useQuery(GET_LAWS, {
    variables: { congress: congressNum, lawType: 'pub', page, perPage: PER_PAGE },
    fetchPolicy: 'network-only',
    skip: !enactedOnly,
  });

  const loading = enactedOnly ? lawsLoading : billsLoading;
  const error = enactedOnly ? lawsError : billsError;
  const pageData = enactedOnly ? lawsData?.laws : billsData?.bills;
  const bills = pageData?.bills || [];
  const totalCount = pageData?.totalCount || 0;
  const totalPages = pageData?.totalPages || 1;

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '3rem 2rem' }}>
      <div style={{ marginBottom: '3rem' }}>
        <Link to="/congress" style={{
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
          ← Congress
        </Link>

        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.7rem',
          color: 'var(--gold)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginBottom: '0.75rem',
        }}>
          Congress · {congress ? `${congress.startYear}–${congress.endYear}` : ''}
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
            {congress?.name || `${number}th Congress`}
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
                {enactedOnly ? 'Public Laws' : 'Bills'}
              </div>
            </div>
          )}
        </div>

        {congress?.description && (
          <p style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: '0.875rem',
            color: 'var(--text-muted)',
            margin: '0 0 1rem 0',
            fontWeight: 300,
            lineHeight: 1.5,
            maxWidth: '600px',
          }}>
            {congress.description}
          </p>
        )}
      </div>

      {/* Filters */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ position: 'relative', maxWidth: '480px' }}>
          <span style={{
            position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', fontSize: '0.85rem', pointerEvents: 'none',
          }}>⌕</span>
          <input
            type="text"
            placeholder="Search bills…"
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

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {!enactedOnly && BILL_TYPES.map(opt => (
            <button
              key={opt.label}
              onClick={() => handleBillType(opt.value)}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.65rem',
                letterSpacing: '0.08em',
                padding: '4px 12px',
                borderRadius: '3px',
                border: '1px solid',
                cursor: 'pointer',
                transition: 'all 0.15s',
                borderColor: billType === opt.value ? 'var(--gold)' : 'rgba(201,168,76,0.25)',
                background: billType === opt.value ? 'var(--gold)' : 'transparent',
                color: billType === opt.value ? 'var(--navy)' : 'var(--text-muted)',
                fontWeight: billType === opt.value ? 600 : 400,
              }}
            >
              {opt.label}
            </button>
          ))}

          {/* Divider */}
          {!enactedOnly && (
            <div style={{ width: 1, height: 18, background: 'rgba(201,168,76,0.15)', margin: '0 4px' }} />
          )}

          <button
            onClick={handleEnacted}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.65rem',
              letterSpacing: '0.08em',
              padding: '4px 12px',
              borderRadius: '3px',
              border: '1px solid',
              cursor: 'pointer',
              transition: 'all 0.15s',
              borderColor: enactedOnly ? '#86efac' : 'rgba(134,239,172,0.25)',
              background: enactedOnly ? '#86efac' : 'transparent',
              color: enactedOnly ? 'var(--navy)' : 'rgba(134,239,172,0.6)',
              fontWeight: enactedOnly ? 600 : 400,
            }}
          >
            ✓ Enacted Laws
          </button>
        </div>

        {congressYears.length > 0 && !enactedOnly && (
          <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            {congressYears.map(year => (
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
          {bills.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '5rem 0',
              color: 'var(--text-muted)',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.8rem',
            }}>
              No bills found.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))',
              gap: '1rem',
            }}>
              {bills.map(bill => (
                <BillCard key={bill.id} bill={bill} />
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
