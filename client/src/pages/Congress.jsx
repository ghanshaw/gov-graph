import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_CONGRESSES, GET_BILL_SEARCH } from '../queries';
import useDebounce from '../hooks/useDebounce';
import PageLayout from '../components/PageLayout';
import SearchBox from '../components/SearchBox';
import { RailGroup, Fact, YearFacet } from '../components/Rail';
import Pagination from '../components/Pagination';
import Loading from '../components/Loading';
import { BillTable } from '../components/BillRow';

const PER_PAGE = 20;

const PARTY_CHIP = {
  'Democratic majority': 'chip dem',
  'Republican majority': 'chip rep',
};

export default function Congress() {
  const { data, loading } = useQuery(GET_CONGRESSES);
  const congresses = data?.congresses || [];

  const first = congresses[congresses.length - 1];
  const last = congresses[0];

  // The search lives in the address (?q=), so a session page can link here with its search.
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(query);
  const [debounced, setDebounced] = useDebounce(query, 400);
  const [page, setPage] = useState(1);
  const [congress, setCongress] = useState(null);

  const handleSearch = (val) => {
    setSearchInput(val);
    setDebounced(val);
  };
  // Written to the address after the pause, replacing the entry, so each keystroke is not history.
  useEffect(() => {
    if (debounced === query) return;
    setParams(debounced.trim() ? { q: debounced } : {}, { replace: true });
    setPage(1);
    setCongress(null);
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const searching = query.trim() !== '';
  const { data: searchData, loading: searchLoading, error: searchError } = useQuery(GET_BILL_SEARCH, {
    variables: { query: query.trim(), congress: congress || undefined, page, perPage: PER_PAGE },
    skip: !searching,
  });
  // Counts per Congress come from the search without a Congress chosen, so the facet keeps every option.
  const { data: facetData } = useQuery(GET_BILL_SEARCH, {
    variables: { query: query.trim(), page: 1, perPage: 1 },
    skip: !searching,
  });
  const results = searchData?.billSearch;
  const counts = facetData?.billSearch?.congressCounts ?? [];

  const rail = searching ? (
    <RailGroup title="Congress">
      {counts.length > 0 && (
        <YearFacet
          years={counts.map(c => c.congress)}
          counts={Object.fromEntries(counts.map(c => [c.congress, c.count]))}
          total={facetData.billSearch.billCount}
          value={congress}
          onChange={c => { setCongress(c); setPage(1); }}
        />
      )}
    </RailGroup>
  ) : (
    <>
      <RailGroup title="Coverage">
        <Fact label="Congresses">{congresses.length || '…'}</Fact>
        {first && <Fact label="Years">{first.startYear} – {last.endYear}</Fact>}
      </RailGroup>
      <RailGroup title="Source">
        <p>Bills and laws from the official Congress.gov API.</p>
      </RailGroup>
    </>
  );

  return (
    <PageLayout rail={rail}>
      <div className="crumbs">United States Congress</div>
      <div className="page-head">
        <h1 className="page-title">
          Legislative Bills
          {!searching && congresses.length > 0 && <small>{congresses.length} Congresses</small>}
          {searching && results && (
            <small>
              {results.billCount.toLocaleString()} {results.billCount === 1 ? 'bill' : 'bills'} matching “{query.trim()}”
              {congress && ` · ${congress}th Congress`}
            </small>
          )}
        </h1>
        <SearchBox value={searchInput} onChange={handleSearch} placeholder="Title, H.R. 1, P.L. 119-21…" />
      </div>

      {searching ? (
        <>
          <p className="search-scope">
            Bills of every Congress loaded, by number and by every title a bill has had (official, short and popular
            titles from Congress.gov, and a few names in common use that we added). Best match first.
          </p>
          {searchLoading && <Loading label="Searching…" />}
          {searchError && <div className="error">Search failed: {searchError.message}</div>}
          {results && !searchLoading && (
            results.bills.length === 0
              ? <div className="state">No bills found.</div>
              : <BillTable bills={results.bills} showCongress />
          )}
          {results && !searchLoading && (
            <Pagination
              currentPage={page}
              totalPages={results.totalPages}
              totalCount={results.totalCount}
              perPage={PER_PAGE}
              onPageChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            />
          )}
        </>
      ) : (
        <>
          <p className="lede">
            Browse bills introduced in the {first ? `${first.number}th through ${last.number}th` : ''} Congress. Data sourced from the official Congress.gov API.
          </p>

          {loading && <Loading />}

          {congresses.length > 0 && (
            <table className="records">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Congress</th>
                  <th className="date">Years</th>
                </tr>
              </thead>
              <tbody>
                {congresses.map(c => (
                  <tr key={c.number}>
                    <td className="no">{c.number}</td>
                    <td className="title">
                      <Link to={`/congress/${c.number}`}>{c.name}</Link>
                      <span className="sub">{c.description}</span>
                      <div className="chips">
                        <span className={PARTY_CHIP[c.senate] || 'chip'}>Senate: {c.senate}</span>
                        <span className={PARTY_CHIP[c.house] || 'chip'}>House: {c.house}</span>
                      </div>
                    </td>
                    <td className="date">{c.startYear} – {c.endYear}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </PageLayout>
  );
}
