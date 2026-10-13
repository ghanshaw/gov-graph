import { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_BILLS, GET_BILL_SEARCH, GET_ENACTED_LAWS, GET_CONGRESSES } from '../queries';
import useDebounce from '../hooks/useDebounce';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import SearchBox from '../components/SearchBox';
import { RailGroup, RadioOptions, CheckOption, YearFacet } from '../components/Rail';
import Pagination from '../components/Pagination';
import Loading from '../components/Loading';
import { BillTable, TYPE_CODE } from '../components/BillRow';
import { shortDate } from '../dates';

const PER_PAGE = 20;

const BILL_TYPES = [
  { value: null, label: 'All' },
  { value: 'HR', label: 'House Bill' },
  { value: 'S', label: 'Senate Bill' },
  { value: 'HJRES', label: 'House Joint Resolution' },
  { value: 'SJRES', label: 'Senate Joint Resolution' },
];

// By introduction date the list comes from the database, where the Congress's bill history is
// loaded; by update date (when the record last changed) it comes from Congress.gov.
const SORTS = [
  { label: 'Newest introduced first', value: 'introduced' },
  { label: 'Oldest introduced first', value: 'introduced-oldest' },
  { label: 'Latest update first', value: 'newest' },
  { label: 'Earliest update first', value: 'oldest' },
];

const LAW_TYPES = [
  { label: 'Public laws', value: 'pub' },
  { label: 'Private laws', value: 'priv' },
];

const LAW_SORTS = [
  { label: 'Newest law first', value: 'newest' },
  { label: 'Oldest law first', value: 'oldest' },
];

// One enacted law, as Congress.gov's "Statutes at Large and Public Laws" list shows it. The
// citation and the link to the slip law appear once GPO has published the law.
function LawRow({ law }) {
  const { bill } = law;
  return (
    <tr>
      <td className="mono nowrap">{law.statuteCitation ?? ''}</td>
      <td className="no">
        {law.slipLawUrl
          ? <a href={law.slipLawUrl} target="_blank" rel="noopener noreferrer">{law.lawType === 'priv' ? 'Pvt. L.' : 'PL'} {law.number} ↗</a>
          : `${law.lawType === 'priv' ? 'Pvt. L.' : 'PL'} ${law.number}`}
      </td>
      <td className="title">
        <Link to={`/congress/${bill.congress}/${bill.type.toLowerCase()}/${bill.number}`}>
          <span className="bill-label">{TYPE_CODE[bill.type] || bill.type} {bill.number}</span> — {bill.title || 'Untitled'}
        </Link>
      </td>
      <td className="date">{shortDate(law.date)}</td>
    </tr>
  );
}

export default function CongressSession() {
  const { number } = useParams();
  const congressNum = parseInt(number);

  // A search can arrive in the address (?q=), e.g. from the search across every Congress.
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('q') ?? '';
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useDebounce(initialSearch, 400);
  const [billType, setBillType] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [enactedOnly, setEnactedOnly] = useState(false);
  const [sort, setSort] = useState('introduced');
  const [lawType, setLawType] = useState('pub');
  const [lawSort, setLawSort] = useState('newest');

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

  const handleEnacted = (val) => {
    setEnactedOnly(val);
    setPage(1);
  };

  const handleYear = (year) => {
    setSelectedYear(year);
    setPage(1);
  };

  const handleSort = (val) => {
    setSort(val);
    setPage(1);
  };

  // A search lists the best matches first (billSearch); otherwise the Congress's bills in the order chosen.
  const searching = !enactedOnly && debouncedSearch.trim() !== '';
  const { data: listData, loading: listLoading, error: listError } = useQuery(GET_BILLS, {
    variables: {
      congress: congressNum,
      billType: billType || undefined,
      page,
      perPage: PER_PAGE,
      year: selectedYear || undefined,
      order: sort,
    },
    fetchPolicy: 'network-only',
    skip: enactedOnly || searching,
  });
  const { data: searchData, loading: searchLoading, error: searchError } = useQuery(GET_BILL_SEARCH, {
    variables: {
      query: debouncedSearch.trim(),
      congress: congressNum,
      billType: billType || undefined,
      year: selectedYear || undefined,
      page,
      perPage: PER_PAGE,
    },
    skip: !searching,
  });
  const billsLoading = searching ? searchLoading : listLoading;
  const billsError = searching ? searchError : listError;

  // Every enacted law at once (a Congress passes a few hundred at most), newest first.
  const { data: lawsData, loading: lawsLoading, error: lawsError } = useQuery(GET_ENACTED_LAWS, {
    variables: { congress: congressNum, lawType },
    skip: !enactedOnly,
  });
  const laws = lawSort === 'oldest' ? [...(lawsData?.enactedLaws ?? [])].reverse() : lawsData?.enactedLaws ?? [];

  const loading = enactedOnly ? lawsLoading : billsLoading;
  const error = enactedOnly ? lawsError : billsError;
  const pageData = searching ? searchData?.billSearch : listData?.bills;
  const bills = pageData?.bills || [];
  const totalCount = enactedOnly ? laws.length : pageData?.totalCount || 0;
  const totalPages = pageData?.totalPages || 1;
  // From the database, rows can hold an identical House and Senate bill together, so there are
  // more bills than rows. The heading counts bills; the pager counts rows.
  const billCount = enactedOnly ? totalCount : pageData?.billCount ?? totalCount;
  const sharedRows = !enactedOnly && billCount > totalCount;

  // Asked for by introduction date, but this Congress's bill history is not loaded.
  const sortFellBack = !enactedOnly && !searching && sort.startsWith('introduced') && pageData?.order && !pageData.order.startsWith('introduced');

  const name = congress?.name || `${number}th Congress`;
  const noun = enactedOnly ? (lawType === 'priv' ? 'private law' : 'public law') : 'bill';

  // The list of enacted laws has filters of its own; the bill filters step aside.
  const rail = (
    <>
      <RailGroup title="Show">
        <CheckOption label="Enacted laws only" checked={enactedOnly} onChange={handleEnacted} />
      </RailGroup>
      {enactedOnly && (
        <>
          <RailGroup title="Law type">
            <RadioOptions label="Law type" options={LAW_TYPES} value={lawType} onChange={setLawType} />
          </RailGroup>
          <RailGroup title="Order">
            <RadioOptions label="Order" options={LAW_SORTS} value={lawSort} onChange={setLawSort} />
          </RailGroup>
        </>
      )}
      {!enactedOnly && (
        <>
          {congressYears.length > 0 && (
            <RailGroup title="Year introduced">
              <YearFacet years={congressYears} value={selectedYear} onChange={handleYear} />
            </RailGroup>
          )}
          <RailGroup title="Bill type">
            <RadioOptions label="Bill type" options={BILL_TYPES} value={billType} onChange={handleBillType} />
          </RailGroup>
          <RailGroup title="Order">
            {searching
              ? <p>Best match first while searching.</p>
              : <RadioOptions label="Order" options={SORTS} value={sort} onChange={handleSort} />}
          </RailGroup>
        </>
      )}
    </>
  );

  return (
    <PageLayout rail={rail}>
      <Crumbs items={[{ label: 'Congress', to: '/congress' }, { label: name }]} />
      <div className="page-head">
        <h1 className="page-title">
          {name}
          {!loading && !error && (
            <small>
              {billCount.toLocaleString()} {billCount === 1 ? noun : `${noun}s`}
              {congress && ` · ${!enactedOnly && selectedYear ? selectedYear : `${congress.startYear}–${congress.endYear}`}`}
              {!enactedOnly && debouncedSearch && ` · matching “${debouncedSearch}”`}
            </small>
          )}
        </h1>
        {!enactedOnly && <SearchBox value={searchInput} onChange={handleSearch} placeholder="Title, H.R. 1, P.L. 119-21…" />}
      </div>
      {searching && (
        <p className="search-scope">
          Searching the {name} by number and by every title a bill has had ·{' '}
          <Link to={`/congress?q=${encodeURIComponent(debouncedSearch.trim())}`}>search all Congresses</Link>
        </p>
      )}
      {congress?.description && <p className="lede">{congress.description}</p>}

      {loading && <Loading label="Loading records…" />}

      {error && <div className="error">Failed to load data: {error.message}</div>}

      {enactedOnly && !loading && !error && (
        <>
          <p className="source-note">
            A bill appears here once the National Archives assigns it a law number. The Statutes at Large citation and
            the link to the slip law appear once the Government Publishing Office has published the law on govinfo.
            {lawType === 'pub' ? ' Private laws are a separate list.' : ''} The date is the day it became law.
          </p>
          {laws.length === 0 ? (
            <div className="state">No {noun}s yet.</div>
          ) : (
            <table className="records">
              <thead>
                <tr>
                  <th>Statute citation</th>
                  <th>{lawType === 'priv' ? 'Private law' : 'Public law'}</th>
                  <th>Bill and title</th>
                  <th className="date">Became law</th>
                </tr>
              </thead>
              <tbody>
                {laws.map(law => <LawRow key={law.number} law={law} />)}
              </tbody>
            </table>
          )}
        </>
      )}

      {!enactedOnly && !loading && !error && (
        <>
          {sortFellBack && (
            <p className="source-note">
              Introduction dates for this Congress are not loaded yet, so the list is in Congress.gov’s order: latest
              update first.
            </p>
          )}
          {sharedRows && (
            <p className="source-note">
              A House bill and a Senate bill that are the same proposal share a row: Congress.gov marks them identical,
              or at least 60% of their text is the same — {(billCount - totalCount).toLocaleString()} such{' '}
              {billCount - totalCount === 1 ? 'pair' : 'pairs'} here. Each keeps its own number, sponsor and latest action.
            </p>
          )}
          {bills.length === 0 ? (
            <div className="state">No bills found.</div>
          ) : (
            <BillTable bills={bills} />
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
