export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const getPages = () => {
    const pages = [];
    const delta = 2;
    const left = currentPage - delta;
    const right = currentPage + delta;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= left && i <= right)) {
        pages.push(i);
      }
    }

    const withEllipsis = [];
    let prev = null;
    for (const page of pages) {
      if (prev && page - prev > 1) withEllipsis.push('...');
      withEllipsis.push(page);
      prev = page;
    }
    return withEllipsis;
  };

  const btnBase = {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.75rem',
    padding: '6px 12px',
    border: '1px solid rgba(201,168,76,0.25)',
    borderRadius: '3px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    background: 'transparent',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
  };

  const activeStyle = {
    ...btnBase,
    background: 'var(--gold)',
    color: 'var(--navy)',
    border: '1px solid var(--gold)',
    fontWeight: 600,
  };

  const disabledStyle = {
    ...btnBase,
    opacity: 0.3,
    cursor: 'not-allowed',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '2rem 0' }}>
      <button
        style={currentPage === 1 ? disabledStyle : btnBase}
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        onMouseEnter={e => { if (currentPage !== 1) e.currentTarget.style.color = 'var(--gold)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        ← Prev
      </button>

      {getPages().map((page, i) =>
        page === '...'
          ? <span key={`e-${i}`} style={{ color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0 4px' }}>…</span>
          : (
            <button
              key={page}
              style={page === currentPage ? activeStyle : btnBase}
              onClick={() => onPageChange(page)}
              onMouseEnter={e => { if (page !== currentPage) e.currentTarget.style.color = 'var(--gold)'; }}
              onMouseLeave={e => { if (page !== currentPage) e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              {page}
            </button>
          )
      )}

      <button
        style={currentPage === totalPages ? disabledStyle : btnBase}
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        onMouseEnter={e => { if (currentPage !== totalPages) e.currentTarget.style.color = 'var(--gold)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        Next →
      </button>
    </div>
  );
}
