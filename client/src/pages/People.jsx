import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_PEOPLE } from '../queries';
import useDebounce from '../hooks/useDebounce';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import SearchBox from '../components/SearchBox';
import Pagination from '../components/Pagination';
import { RailGroup, RadioOptions, CheckOption } from '../components/Rail';
import { ROLE_LABELS, ROLE_OPTIONS, STATES, partyClass, years } from '../people';
import Loading from '../components/Loading';

const PER_PAGE = 50;

const PARTIES = [
  { value: null, label: 'All' },
  { value: 'Democrat', label: 'Democrat' },
  { value: 'Republican', label: 'Republican' },
  { value: 'Independent', label: 'Independent' },
];

// Dates are those of the latest office, as the Years column shows them.
const ORDERS = [
  { value: 'name', label: 'Name, A–Z' },
  { value: 'start_desc', label: 'Start date, newest first' },
  { value: 'start_asc', label: 'Start date, oldest first' },
  { value: 'end_desc', label: 'End date, newest first' },
  { value: 'end_asc', label: 'End date, oldest first' },
];

export default function People() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useDebounce('', 400);
  const [roleType, setRoleType] = useState(null);
  const [current, setCurrent] = useState(true);
  const [party, setParty] = useState(null);
  const [state, setState] = useState('');
  const [sort, setSort] = useState('name');

  // Every filter change starts again from the first page.
  const change = setter => value => { setter(value); setPage(1); };

  const { data, loading, error } = useQuery(GET_PEOPLE, {
    variables: {
      search: search || undefined, roleType: roleType || undefined, current: current || undefined,
      party: party || undefined, state: state || undefined, sort, page, perPage: PER_PAGE,
    },
  });
  const result = data?.people;

  const rail = (
    <>
      <RailGroup title="Order">
        <RadioOptions label="Order" options={ORDERS} value={sort} onChange={change(setSort)} />
      </RailGroup>
      <RailGroup title="Show">
        <CheckOption label="In office now" checked={current} onChange={change(setCurrent)} />
      </RailGroup>
      <RailGroup title="Office held">
        <RadioOptions label="Office held" options={ROLE_OPTIONS} value={roleType} onChange={change(setRoleType)} />
      </RailGroup>
      <RailGroup title="Party">
        <RadioOptions label="Party" options={PARTIES} value={party} onChange={change(setParty)} />
      </RailGroup>
      <RailGroup title="State">
        <select className="rail-select" value={state} onChange={e => change(setState)(e.target.value)} aria-label="State">
          <option value="">All states</option>
          {Object.entries(STATES).sort((a, b) => a[1].localeCompare(b[1])).map(([code, name]) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
      </RailGroup>
    </>
  );

  return (
    <PageLayout rail={rail}>
      <Crumbs items={[{ label: 'People' }]} />
      <div className="page-head">
        <h1 className="page-title">
          People
          {result && <small>{result.totalCount.toLocaleString()} {result.totalCount === 1 ? 'person' : 'people'}</small>}
        </h1>
        <SearchBox
          value={searchInput}
          onChange={v => { setSearchInput(v); setSearch(v); setPage(1); }}
          placeholder="Search by name…"
        />
      </div>
      <p className="lede">
        Members of Congress since 1789, presidents and vice presidents, and the Justices of the Supreme Court. Party and state are those of the latest office;
        votes and bills are stored for the 119th Congress.
      </p>

      {loading && !result && <Loading label="Loading people…" />}
      {error && <div className="error">Failed to load people: {error.message}</div>}
      {result && (
        result.people.length === 0 ? <div className="state">No one found.</div> : (
          <>
            <table className="records">
              <thead>
                <tr><th>Name</th><th>Office</th><th className="wide-only">State</th><th>Party</th><th className="date">Years</th></tr>
              </thead>
              <tbody>
                {result.people.map(p => (
                  <tr key={p.id}>
                    <td className="title">
                      <Link to={`/people/${p.id}`}>{p.sortName ?? p.name}</Link>
                      {p.roleTypes.length > 1 && (
                        <span className="sub">{p.roleTypes.map(r => ROLE_LABELS[r] ?? r).join(', ')}</span>
                      )}
                    </td>
                    <td className="meta">{ROLE_LABELS[p.roleType] ?? p.roleType}</td>
                    <td className="meta wide-only">{STATES[p.state] ?? p.state ?? ''}</td>
                    <td>{p.party && <span className={`chip ${partyClass(p.party)}`}>{p.party}</span>}</td>
                    <td className="date">{years(p.start, p.end, p.current)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              currentPage={page}
              totalPages={result.totalPages}
              totalCount={result.totalCount}
              perPage={PER_PAGE}
              onPageChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            />
          </>
        )
      )}
    </PageLayout>
  );
}
