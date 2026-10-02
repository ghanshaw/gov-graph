// totalCount and perPage are optional; with both, the range shown ("Showing 1–20 of 294") is printed on the left.
export default function Pagination({ currentPage, totalPages, onPageChange, totalCount, perPage }) {
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

  const first = (currentPage - 1) * perPage + 1;
  const last = Math.min(currentPage * perPage, totalCount);

  return (
    <div className="pager">
      <span>
        {totalCount != null && perPage
          ? `Showing ${first.toLocaleString()}–${last.toLocaleString()} of ${totalCount.toLocaleString()}`
          : `Page ${currentPage} of ${totalPages}`}
      </span>
      <div className="pages">
        <button type="button" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
          ← Prev
        </button>

        {getPages().map((page, i) =>
          page === '...'
            ? <span key={`e-${i}`} className="gap">…</span>
            : (
              <button
                key={page}
                type="button"
                className={page === currentPage ? 'on' : undefined}
                aria-current={page === currentPage ? 'page' : undefined}
                onClick={() => onPageChange(page)}
              >
                {page}
              </button>
            )
        )}

        <button type="button" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>
          Next →
        </button>
      </div>
    </div>
  );
}
