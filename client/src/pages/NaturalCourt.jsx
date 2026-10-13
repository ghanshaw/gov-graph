import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_SCOTUS_CASES, GET_NATURAL_COURTS } from '../queries';
import useDebounce from '../hooks/useDebounce';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import SearchBox from '../components/SearchBox';
import { RailGroup, RadioOptions, YearFacet } from '../components/Rail';
import Pagination from '../components/Pagination';
import Loading from '../components/Loading';
import { shortDate } from '../dates';

const PER_PAGE = 20;

const SORTS = [
  { value: 'dateFiled desc', label: 'Newest first' },
  { value: 'dateFiled asc', label: 'Oldest first' },
];

const DIRECTION_LABEL = {
  'liberal': 'Liberal',
  'conservative': 'Conservative',
  'unspecifiable': null,
};

function CaseRow({ scotusCase, courtSlug }) {
  const voteDisplay = scotusCase.votesMajority != null && scotusCase.votesMinority != null
    ? `${scotusCase.votesMajority}–${scotusCase.votesMinority}`
    : null;
  const direction = DIRECTION_LABEL[scotusCase.decisionDirection] || null;

  return (
    <tr>
      <td className="no">{scotusCase.citation ?? '—'}</td>
      <td className="title">
        <Link to={`/supreme-court/${courtSlug}/${scotusCase.id}`}>{scotusCase.caseName}</Link>
        {scotusCase.docketNumber && <span className="sub">No. {scotusCase.docketNumber}</span>}
      </td>
      <td className="meta nowrap wide-only">
        {voteDisplay && <span className="mono">{voteDisplay}</span>}
        {direction && ` ${direction}`}
      </td>
      <td className="date">{shortDate(scotusCase.dateFiled)}</td>
    </tr>
  );
}

export default function NaturalCourt() {
  const { courtSlug } = useParams();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useDebounce('', 400);
  const [orderBy, setOrderBy] = useState('dateFiled desc');
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
    setSelectedYear(year);
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

  const rail = (
    <>
      {courtYears.length > 0 && (
        <RailGroup title="Year decided">
          <YearFacet years={courtYears} value={selectedYear} onChange={handleYear} />
        </RailGroup>
      )}
      <div>
        <RailGroup title="Order">
          <RadioOptions label="Order" options={SORTS} value={orderBy} onChange={handleOrderBy} />
        </RailGroup>
        {court?.justices && (
          <RailGroup title="Justices">
            <div className="chips">
              {court.justices.map(j => <span key={j} className="chip">{j}</span>)}
            </div>
          </RailGroup>
        )}
      </div>
    </>
  );

  const dateSort = orderBy.startsWith('dateFiled');

  return (
    <PageLayout rail={rail}>
      <Crumbs items={[{ label: 'Supreme Court', to: '/supreme-court' }, { label: court?.name || courtSlug }]} />
      <div className="page-head">
        <h1 className="page-title">
          {court?.name || courtSlug}
          {!loading && !error && (
            <small>
              {totalCount.toLocaleString()} {totalCount === 1 ? 'case' : 'cases'}
              {` · ${selectedYear ?? dateRange}`}
              {debouncedSearch && ` · matching “${debouncedSearch}”`}
            </small>
          )}
        </h1>
        <SearchBox value={searchInput} onChange={handleSearch} placeholder="Search cases…" />
      </div>

      {loading && <Loading label="Loading records…" />}

      {error && <div className="error">Failed to load data: {error.message}</div>}

      {!loading && !error && (
        <>
          {data?.scotusCases && !data.scotusCases.loaded ? (
            <div className="state">
              The decisions of {court?.name ?? 'this Court'} have not been loaded yet.
              Loaded so far: <Link to="/supreme-court/roberts-7">Roberts Court VII</Link> and{' '}
              <Link to="/supreme-court/roberts-8">Roberts Court VIII</Link>.
            </div>
          ) : cases.length === 0 ? (
            <div className="state">No cases found.</div>
          ) : (
            <table className="records">
              <thead>
                <tr>
                  <th>Citation</th>
                  <th>Case</th>
                  <th className="wide-only">Decision</th>
                  <th className={dateSort ? (orderBy.endsWith('asc') ? 'date sorted asc' : 'date sorted') : 'date'}>Decided</th>
                </tr>
              </thead>
              <tbody>
                {cases.map(c => <CaseRow key={c.id} scotusCase={c} courtSlug={courtSlug} />)}
              </tbody>
            </table>
          )}

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
