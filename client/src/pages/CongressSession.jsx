import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_BILLS, GET_LAWS, GET_CONGRESSES } from '../queries';
import useDebounce from '../hooks/useDebounce';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import SearchBox from '../components/SearchBox';
import { RailGroup, RadioOptions, CheckOption, YearFacet } from '../components/Rail';
import Pagination from '../components/Pagination';

const PER_PAGE = 20;

const BILL_TYPES = [
  { value: null, label: 'All' },
  { value: 'HR', label: 'House Bill' },
  { value: 'S', label: 'Senate Bill' },
  { value: 'HJRES', label: 'House Joint Resolution' },
  { value: 'SJRES', label: 'Senate Joint Resolution' },
];

const TYPE_CODE = {
  HR: 'H.R.', S: 'S.', HJRES: 'H.J.Res.', SJRES: 'S.J.Res.',
  HCONRES: 'H.Con.Res.', SCONRES: 'S.Con.Res.', HRES: 'H.Res.', SRES: 'S.Res.',
};

const PARTY_CLASS = { D: 'party-dem', R: 'party-rep', I: 'party-ind' };

function BillRow({ bill }) {
  const truncatedAction = bill.latestActionText && bill.latestActionText.length > 120
    ? bill.latestActionText.slice(0, 120) + '…'
    : bill.latestActionText;

  return (
    <tr>
      <td className="no">{TYPE_CODE[bill.type] || bill.type} {bill.number}</td>
      <td className="title">
        <Link to={`/congress/${bill.congress}/${bill.type.toLowerCase()}/${bill.number}`}>
          {bill.title || 'Untitled Bill'}
        </Link>
        {bill.sponsor && (
          <span className="sub">
            {bill.sponsor.fullName}
            {bill.sponsor.party && (
              <span className={PARTY_CLASS[bill.sponsor.party]}> ({bill.sponsor.party}-{bill.sponsor.state})</span>
            )}
          </span>
        )}
        {truncatedAction && <span className="sub">{truncatedAction}</span>}
      </td>
      <td className="wide-only">{bill.policyArea && <span className="chip">{bill.policyArea}</span>}</td>
      <td className="date">{bill.introducedDate ?? ''}</td>
    </tr>
  );
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

  const handleEnacted = (val) => {
    setEnactedOnly(val);
    setPage(1);
  };

  const handleYear = (year) => {
    setSelectedYear(year);
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

  const name = congress?.name || `${number}th Congress`;
  const noun = enactedOnly ? 'public law' : 'bill';

  // The list of enacted laws takes no other filter, so the rest of the rail steps aside.
  const rail = (
    <>
      <RailGroup title="Show">
        <CheckOption label="Enacted laws only" checked={enactedOnly} onChange={handleEnacted} />
      </RailGroup>
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
              {totalCount.toLocaleString()} {totalCount === 1 ? noun : `${noun}s`}
              {congress && ` · ${!enactedOnly && selectedYear ? selectedYear : `${congress.startYear}–${congress.endYear}`}`}
              {!enactedOnly && debouncedSearch && ` · matching “${debouncedSearch}”`}
            </small>
          )}
        </h1>
        {!enactedOnly && <SearchBox value={searchInput} onChange={handleSearch} placeholder="Search bills…" />}
      </div>
      {congress?.description && <p className="lede">{congress.description}</p>}

      {loading && <div className="state">Loading records…</div>}

      {error && <div className="error">Failed to load data: {error.message}</div>}

      {!loading && !error && (
        <>
          {bills.length === 0 ? (
            <div className="state">No bills found.</div>
          ) : (
            <table className="records">
              <thead>
                <tr>
                  <th>Bill</th>
                  <th>Title</th>
                  <th className="wide-only">Policy area</th>
                  <th className="date">Introduced</th>
                </tr>
              </thead>
              <tbody>
                {bills.map(bill => <BillRow key={bill.id} bill={bill} />)}
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
