import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_PERSON, GET_PERSON_VOTES, GET_PERSON_BILLS, GET_PERSON_PRESIDENTIAL_ACTIONS } from '../queries';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import Pagination from '../components/Pagination';
import { RailGroup, Fact } from '../components/Rail';
import { ROLE_LABELS, STATES, partyClass, billCode, billPath, years, year, formatDate, roleTitle } from '../people';
import Loading from '../components/Loading';
import { shortDate } from '../dates';

const PER_PAGE = 25;
const POSITIONS = ['Yea', 'Nay', 'Present', 'Not Voting'];

// Small row of choices above a list: [{ value, label, count }]
function ListFilter({ label, options, value, onChange }) {
  return (
    <div className="list-filter" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'on' : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}{o.count != null && <span className="count">{o.count.toLocaleString()}</span>}
        </button>
      ))}
    </div>
  );
}

function Votes({ personId, stint }) {
  const [position, setPosition] = useState(null);
  const [congress, setCongress] = useState(null);
  const [page, setPage] = useState(1);
  const { data, loading, error } = useQuery(GET_PERSON_VOTES, {
    variables: { id: personId, from: stint.start, to: stint.end, congress, position, page, perPage: PER_PAGE },
  });
  const result = data?.personVotes;
  const counts = Object.fromEntries((result?.positions ?? []).map(p => [p.position, p.count]));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="person-list">
      <div className="list-filters">
        <ListFilter
          label="Position"
          value={position}
          onChange={v => { setPosition(v); setPage(1); }}
          options={[{ value: null, label: 'All', count: total },
            ...POSITIONS.filter(p => counts[p]).map(p => ({ value: p, label: p === 'Not Voting' ? 'No vote' : p, count: counts[p] }))]}
        />
        {stint.congresses.length > 1 && (
          <ListFilter
            label="Congress"
            value={congress}
            onChange={v => { setCongress(v); setPage(1); }}
            options={[{ value: null, label: 'All Congresses' }, ...stint.congresses.map(c => ({ value: c, label: `${c}th` }))]}
          />
        )}
      </div>
      {loading && !result && <Loading label="Loading votes…" />}
      {error && <div className="error">Failed to load votes: {error.message}</div>}
      {result && (
        <>
          <table className="records">
            <thead>
              <tr><th>Bill</th><th>Question</th><th>Vote</th><th className="date">Date</th></tr>
            </thead>
            <tbody>
              {result.votes.map(v => (
                <tr key={v.rollCallId}>
                  <td className="no">{v.bill ? <Link to={billPath(v.bill)}>{billCode(v.bill)}</Link> : '—'}</td>
                  <td className="title">
                    {v.bill ? <Link to={billPath(v.bill)}>{v.bill.title}</Link> : null}
                    <span className="sub">
                      {v.question}{v.amendment ? ` (${v.amendment})` : ''}{v.result ? ` · ${v.result}` : ''}
                    </span>
                  </td>
                  <td className="nowrap">
                    <span className={`position ${v.position === 'Yea' ? 'yea' : v.position === 'Nay' ? 'nay' : ''}`}>
                      {v.position === 'Not Voting' ? 'No vote' : v.position}
                    </span>
                  </td>
                  <td className="date">{shortDate(v.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(result.totalCount / PER_PAGE) || 1}
            totalCount={result.totalCount}
            perPage={PER_PAGE}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

function Bills({ personId, stint, role }) {
  const [congress, setCongress] = useState(null);
  const [page, setPage] = useState(1);
  const { data, loading, error } = useQuery(GET_PERSON_BILLS, {
    variables: { id: personId, role, from: stint.start, to: stint.end, congress, page, perPage: PER_PAGE },
  });
  const result = data?.personBills;

  return (
    <div className="person-list">
      {stint.congresses.length > 1 && (
        <div className="list-filters">
          <ListFilter
            label="Congress"
            value={congress}
            onChange={v => { setCongress(v); setPage(1); }}
            options={[{ value: null, label: 'All Congresses' }, ...stint.congresses.map(c => ({ value: c, label: `${c}th` }))]}
          />
        </div>
      )}
      {loading && !result && <Loading label="Loading bills…" />}
      {error && <div className="error">Failed to load bills: {error.message}</div>}
      {result && (
        <>
          <table className="records">
            <thead>
              <tr><th>Bill</th><th>Title</th><th className="date">{role === 'sponsor' ? 'Introduced' : 'Cosponsored'}</th></tr>
            </thead>
            <tbody>
              {result.bills.map(b => (
                <tr key={`${b.bill.type}-${b.bill.number}`}>
                  <td className="no"><Link to={billPath(b.bill)}>{billCode(b.bill)}</Link></td>
                  <td className="title">
                    <Link to={billPath(b.bill)}>{b.bill.title}</Link>
                    {b.latestAction && <span className="sub">{b.latestAction}</span>}
                    {(b.isOriginal || b.withdrawnDate) && (
                      <span className="chips">
                        {b.isOriginal && <span className="chip">Original cosponsor</span>}
                        {b.withdrawnDate && <span className="chip warn">Withdrawn {formatDate(b.withdrawnDate)}</span>}
                      </span>
                    )}
                  </td>
                  <td className="date">{shortDate(role === 'sponsor' ? b.introducedDate : b.sponsorshipDate ?? b.introducedDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(result.totalCount / PER_PAGE) || 1}
            totalCount={result.totalCount}
            perPage={PER_PAGE}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

// Bills signed or vetoed during a presidency; `kind` is 'signed' or 'vetoed' (pocket vetoes included).
function PresidentialActions({ personId, stint, kind }) {
  const { data, loading, error } = useQuery(GET_PERSON_PRESIDENTIAL_ACTIONS, {
    variables: { id: personId, from: stint.start, to: stint.end },
  });
  const actions = (data?.personPresidentialActions ?? []).filter(a => (kind === 'signed' ? a.action === 'signed' : a.action !== 'signed'));
  const [page, setPage] = useState(1);
  const shown = actions.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  if (loading) return <Loading label="Loading bills…" />;
  if (error) return <div className="error">Failed to load bills: {error.message}</div>;
  return (
    <div className="person-list">
      <table className="records">
        <thead>
          <tr><th>Bill</th><th>Title</th><th>{kind === 'signed' ? 'Law' : 'Action'}</th><th className="date">Date</th></tr>
        </thead>
        <tbody>
          {shown.map(a => (
            <tr key={`${a.bill.type}-${a.bill.number}-${a.action}`}>
              <td className="no"><Link to={billPath(a.bill)}>{billCode(a.bill)}</Link></td>
              <td className="title"><Link to={billPath(a.bill)}>{a.bill.title}</Link></td>
              <td className="nowrap">
                {kind === 'signed'
                  ? (a.law ? `Pub. L. ${a.law}` : '—')
                  : <span className="chip danger">{a.action === 'pocket vetoed' ? 'Pocket veto' : 'Veto'}</span>}
              </td>
              <td className="date">{shortDate(a.date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination
        currentPage={page}
        totalPages={Math.ceil(actions.length / PER_PAGE) || 1}
        totalCount={actions.length}
        perPage={PER_PAGE}
        onPageChange={setPage}
      />
    </div>
  );
}

// The lists a stint can show, in button order, with their counts.
function listsFor(stint) {
  const c = stint.counts;
  return [
    { key: 'votes', label: 'votes', count: c.votes },
    { key: 'sponsored', label: 'sponsored', count: c.sponsored },
    { key: 'cosponsored', label: 'cosponsored', count: c.cosponsored },
    { key: 'signed', label: 'signed', count: c.signed },
    { key: 'vetoed', label: 'vetoed', count: c.vetoed },
  ].filter(l => l.count > 0);
}

function Stint({ personId, stint, initiallyOpen }) {
  const lists = listsFor(stint);
  const [open, setOpen] = useState(initiallyOpen ? lists[0]?.key ?? null : null);
  const toggle = key => setOpen(o => (o === key ? null : key));
  const legislative = stint.roleType === 'representative' || stint.roleType === 'senator';
  const hasDocuments = stint.presidentSlug && (stint.counts.orders > 0 || stint.counts.memoranda > 0);

  return (
    <section className="stint" id={stint.key}>
      <p className="eyebrow">{years(stint.start, stint.end, stint.current)}</p>
      <h2 className="stint-title">{roleTitle(stint)}</h2>
      {/* Justices have no party or terms; they are appointed. */}
      {stint.appointedBy ? (
        <p className="stint-meta"><span>Appointed by {stint.appointedBy}</span></p>
      ) : (
      <p className="stint-meta">
        {stint.parties.map((p, i) => (
          <span key={i} className={`chip ${partyClass(p.party)}`}>
            {p.party ?? 'No party'}
            {stint.parties.length > 1 && ` · ${formatDate(p.start)} – ${stint.current && i === stint.parties.length - 1 ? 'present' : formatDate(p.end)}`}
          </span>
        ))}
        <span>{stint.terms} {stint.terms === 1 ? 'term' : 'terms'}</span>
      </p>
      )}

      {(lists.length > 0 || hasDocuments) && (
        <div className="actions">
          {lists.map(l => (
            <button
              key={l.key}
              type="button"
              className={open === l.key ? 'btn active' : 'btn'}
              aria-expanded={open === l.key}
              onClick={() => toggle(l.key)}
            >
              {open === l.key ? `Hide ${l.label}` : `Show ${l.label} (${l.count.toLocaleString()})`}
            </button>
          ))}
          {hasDocuments && stint.counts.orders > 0 && (
            <Link className="btn" to={`/${stint.presidentSlug}/executive-orders`}>
              Executive orders ({stint.counts.orders.toLocaleString()})
            </Link>
          )}
          {hasDocuments && stint.counts.memoranda > 0 && (
            <Link className="btn" to={`/${stint.presidentSlug}/memoranda`}>
              Memoranda ({stint.counts.memoranda.toLocaleString()})
            </Link>
          )}
        </div>
      )}
      {lists.length === 0 && (legislative || stint.roleType === 'president') && (
        <p className="stint-note">
          No {legislative ? 'votes or bills' : 'bills'} are stored for these years; only the 119th Congress (2025–2026) is loaded.
        </p>
      )}

      {open === 'votes' && <Votes personId={personId} stint={stint} />}
      {open === 'sponsored' && <Bills personId={personId} stint={stint} role="sponsor" />}
      {open === 'cosponsored' && <Bills personId={personId} stint={stint} role="cosponsor" />}
      {(open === 'signed' || open === 'vetoed') && <PresidentialActions personId={personId} stint={stint} kind={open} />}
    </section>
  );
}

function outboundLinks(person) {
  const ids = person.otherIds ?? {};
  return [
    person.bioguideId && { label: 'Bioguide', url: `https://bioguide.congress.gov/search/bio/${person.bioguideId}` },
    ids.wikipedia && { label: 'Wikipedia', url: `https://en.wikipedia.org/wiki/${encodeURIComponent(ids.wikipedia.replace(/ /g, '_'))}` },
    person.wikidataId && { label: 'Wikidata', url: `https://www.wikidata.org/wiki/${person.wikidataId}` },
    ids.govtrack && { label: 'GovTrack', url: `https://www.govtrack.us/congress/members/${ids.govtrack}` },
  ].filter(Boolean);
}

export default function Person() {
  const { id } = useParams();
  const { data, loading, error } = useQuery(GET_PERSON, { variables: { id } });
  const person = data?.person;

  if (!person) {
    return (
      <PageLayout rail={null}>
        <Crumbs items={[{ label: 'People', to: '/people' }, { label: '…' }]} />
        {loading && <Loading />}
        {error && <div className="error">Failed to load person: {error.message}</div>}
        {!loading && !error && <div className="state">Person not found.</div>}
      </PageLayout>
    );
  }

  const stints = person.stints;
  const latest = stints[0];
  const latestParty = latest?.parties[latest.parties.length - 1]?.party;
  // The newest stint with anything stored opens its first list.
  const openKey = stints.find(s => listsFor(s).length > 0)?.key;

  const rail = (
    <>
      {(person.birthDate || person.deathDate) && (
        <RailGroup title="Person">
          {person.birthDate && <Fact label="Born">{formatDate(person.birthDate)}</Fact>}
          {person.deathDate && <Fact label="Died">{formatDate(person.deathDate)}</Fact>}
        </RailGroup>
      )}
      <RailGroup title="Roles">
        <nav className="role-nav">
          {stints.map(s => (
            <a key={s.key} href={`#${s.key}`} className={s.current ? 'on' : undefined}>
              <span>{ROLE_LABELS[s.roleType]}{s.state ? `, ${s.state}` : ''}</span>
              <span className="count">{year(s.start)}–{s.current ? '' : year(s.end)}</span>
            </a>
          ))}
        </nav>
      </RailGroup>
    </>
  );

  return (
    <PageLayout rail={rail}>
      <Crumbs items={[{ label: 'People', to: '/people' }, { label: person.name }]} />
      <div className="page-head">
        <h1 className="page-title">
          {person.name}
          {latest && <small>{latest.current ? roleTitle(latest) : `Former ${roleTitle(latest)}`}</small>}
        </h1>
      </div>
      <dl className="facts">
        {latest && <div><dt>{latest.current ? 'Current role' : 'Last role'}</dt><dd>{ROLE_LABELS[latest.roleType]}</dd></div>}
        {latest?.state && <div><dt>State</dt><dd>{STATES[latest.state] ?? latest.state}</dd></div>}
        {latestParty && <div><dt>Party</dt><dd className={`party-${partyClass(latestParty)}`}>{latestParty}</dd></div>}
        {stints.length > 0 && <div><dt>First took office</dt><dd>{year(stints[stints.length - 1].start)}</dd></div>}
      </dl>
      <div className="actions">
        {outboundLinks(person).map(l => (
          <a key={l.label} className="btn" href={l.url} target="_blank" rel="noopener noreferrer">{l.label} ↗</a>
        ))}
      </div>

      {stints.map(s => <Stint key={s.key} personId={person.id} stint={s} initiallyOpen={s.key === openKey} />)}
    </PageLayout>
  );
}
