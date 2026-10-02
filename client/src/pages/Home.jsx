import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_EXECUTIVE_ORDERS, GET_EXECUTIVE_ORDER_YEAR_COUNTS } from '../queries';
import useDebounce from '../hooks/useDebounce';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import SearchBox from '../components/SearchBox';
import { RailGroup, RadioOptions, YearFacet, Fact } from '../components/Rail';
import OrderTable from '../components/OrderTable';
import Pagination from '../components/Pagination';
import TimelineView from '../components/TimelineView';

const SORTS = [
  { label: 'Newest first', value: 'newest' },
  { label: 'Oldest first', value: 'oldest' },
];

const VIEWS = [
  { label: 'Table', value: 'table' },
  { label: 'Timeline', value: 'timeline' },
];

const PER_PAGE = 20;

const PRESIDENT_META = {
  'barack-obama':  { name: 'Barack Obama',  years: [2009,2010,2011,2012,2013,2014,2015,2016,2017] },
  'donald-trump':    { name: 'Donald Trump', years: [2017,2018,2019,2020,2021] },
  'donald-trump-47': { name: 'Donald Trump', years: [2025,2026] },
  'joseph-biden':  { name: 'Joe Biden',     years: [2021,2022,2023,2024,2025] },
};

const DOC_TYPE_META = {
  'executive-orders': { apiKey: 'executive_order',      label: 'Executive Orders' },
  'memoranda':        { apiKey: 'memorandum',              label: 'Presidential Memoranda' },
};

export default function Home() {
  const { slug, docType } = useParams();
  const meta = PRESIDENT_META[slug] || { name: slug, years: [] };
  const docMeta = DOC_TYPE_META[docType] || DOC_TYPE_META['executive-orders'];
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useDebounce('', 400);
  const [year, setYear] = useState(null);
  const [view, setView] = useState('table');
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

  const handleSort = (val) => {
    setSort(val);
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
      order: sort,
    },
  });

  const { data: countsData } = useQuery(GET_EXECUTIVE_ORDER_YEAR_COUNTS, {
    variables: {
      president: slug,
      documentType: docMeta.apiKey,
      search: debouncedSearch || undefined,
      years: meta.years,
    },
    skip: meta.years.length === 0,
  });

  // The count behind "All": the same filters with no year.
  const { data: allData } = useQuery(GET_EXECUTIVE_ORDERS, {
    variables: {
      president: slug,
      documentType: docMeta.apiKey,
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
  // Correction notices and the like carry no signing date, so no year counts them.
  const undated = yearCounts && allTotal != null
    ? allTotal - Object.values(yearCounts).reduce((a, b) => a + b, 0)
    : 0;
  // Newest year at the top, as in the table.
  const railYears = [...meta.years].reverse();

  const rail = (
    <>
      <RailGroup title="Year signed">
        <YearFacet years={railYears} counts={yearCounts} total={allTotal} value={year} onChange={handleYear} />
        {undated > 0 && <Fact label="No signing date">{undated.toLocaleString()}</Fact>}
      </RailGroup>
      <div>
        <RailGroup title="View">
          <RadioOptions label="View" options={VIEWS} value={view} onChange={setView} />
        </RailGroup>
        <RailGroup title="Order">
          <RadioOptions label="Order" options={SORTS} value={sort} onChange={handleSort} />
        </RailGroup>
      </div>
    </>
  );

  const span = year ?? (meta.years.length ? `${meta.years[0]}–${meta.years[meta.years.length - 1]}` : null);

  return (
    <PageLayout rail={rail}>
      <Crumbs items={[{ label: 'Presidents', to: '/' }, { label: meta.name, to: `/${slug}` }, { label: docMeta.label }]} />
      <div className="page-head">
        <h1 className="page-title">
          {docMeta.label}
          {!loading && !error && (
            <small>
              {totalCount.toLocaleString()} {totalCount === 1 ? 'document' : 'documents'}
              {span && ` · ${span}`}
              {debouncedSearch && ` · matching “${debouncedSearch}”`}
            </small>
          )}
        </h1>
        <SearchBox value={searchInput} onChange={handleSearch} placeholder="Search by title or number…" />
      </div>

      {loading && <div className="state">Loading records…</div>}

      {error && <div className="error">Failed to load data: {error.message}</div>}

      {!loading && !error && (
        <>
          {orders.length === 0 ? (
            <div className="state">No {docMeta.label.toLowerCase()} found.</div>
          ) : isTimeline ? (
            <TimelineView orders={orders} slug={slug} docType={docType} newestFirst={sort === 'newest'} />
          ) : (
            <OrderTable
              orders={orders}
              slugFor={() => slug}
              docType={docType}
              newestFirst={sort === 'newest'}
              counts={yearCounts}
            />
          )}

          {!isTimeline && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              perPage={PER_PAGE}
              onPageChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            />
          )}
        </>
      )}
    </PageLayout>
  );
}
