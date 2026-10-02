import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_EXECUTIVE_ORDERS, GET_EXECUTIVE_ORDER_YEAR_COUNTS } from '../queries';
import useDebounce from '../hooks/useDebounce';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import SearchBox from '../components/SearchBox';
import { RailGroup, RadioOptions, YearFacet, Fact } from '../components/Rail';
import OrderTable from '../components/OrderTable';
import Pagination from '../components/Pagination';

const PER_PAGE = 20;

// Newest year at the top, as in the table.
const YEARS = Array.from({ length: new Date().getFullYear() - 2008 }, (_, i) => 2009 + i).reverse();

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

// Map API president identifier → app slug (for row links)
// donald-trump API identifier could be either term; we use signing date to disambiguate
const API_TO_SLUG = {
  'donald-trump': 'donald-trump', // default to 45th; row link resolves by year
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
    setYear(val);
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

  const { data: countsData } = useQuery(GET_EXECUTIVE_ORDER_YEAR_COUNTS, {
    variables: {
      president: president || undefined,
      documentType: 'executive_order',
      search: debouncedSearch || undefined,
      years: YEARS,
    },
  });

  // The count behind "All": the same filters with no year. It is more than the listed
  // years add up to: the Federal Register's orders go back to 1994, and correction
  // notices carry no signing date.
  const { data: allData } = useQuery(GET_EXECUTIVE_ORDERS, {
    variables: {
      president: president || undefined,
      documentType: 'executive_order',
      page: 1,
      perPage: 1,
      search: debouncedSearch || undefined,
    },
  });

  const orders = data?.executiveOrders?.orders || [];
  const totalCount = data?.executiveOrders?.totalCount || 0;
  const totalPages = data?.executiveOrders?.totalPages || 1;

  const yearCounts = countsData
    ? Object.fromEntries(countsData.executiveOrderYearCounts.map(c => [c.year, c.count]))
    : null;
  const allTotal = allData?.executiveOrders?.totalCount ?? null;
  const earlier = yearCounts && allTotal != null
    ? allTotal - Object.values(yearCounts).reduce((a, b) => a + b, 0)
    : 0;

  const rail = (
    <>
      <RailGroup title="Year signed">
        <YearFacet years={YEARS} counts={yearCounts} total={allTotal} value={year} onChange={handleYear} />
        {earlier > 0 && <Fact label={`Before ${YEARS[YEARS.length - 1]} or undated`}>{earlier.toLocaleString()}</Fact>}
      </RailGroup>
      <div>
        <RailGroup title="President">
          <RadioOptions label="President" options={PRESIDENTS} value={president} onChange={handlePresident} />
        </RailGroup>
        <RailGroup title="Order">
          <RadioOptions label="Order" options={SORTS} value={sort} onChange={handleSort} />
        </RailGroup>
      </div>
    </>
  );

  return (
    <PageLayout rail={rail}>
      <Crumbs items={[{ label: 'Federal Register' }, { label: 'Executive Orders' }]} />
      <div className="page-head">
        <h1 className="page-title">
          Executive Orders
          {!loading && !error && (
            <small>
              {totalCount.toLocaleString()} {totalCount === 1 ? 'document' : 'documents'}
              {year && ` · ${year}`}
              {president && ` · ${PRESIDENTS.find(p => p.value === president)?.label}`}
              {debouncedSearch && ` · matching “${debouncedSearch}”`}
            </small>
          )}
        </h1>
        <SearchBox value={searchInput} onChange={handleSearch} placeholder="Search by title or number…" autoFocus />
      </div>

      {loading && <div className="state">Loading records…</div>}

      {error && <div className="error">Failed to load data: {error.message}</div>}

      {!loading && !error && orders.length === 0 && (
        <div className="state">No executive orders match your filters.</div>
      )}

      {!loading && !error && orders.length > 0 && (
        <>
          <OrderTable
            orders={orders}
            slugFor={deriveSlug}
            docType="executive-orders"
            showPresident
            newestFirst={sort === 'newest'}
            counts={yearCounts}
          />

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalCount={totalCount}
            perPage={PER_PAGE}
            onPageChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
        </>
      )}
    </PageLayout>
  );
}
