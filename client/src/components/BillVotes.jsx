import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_ROLL_CALL_MEMBERS } from '../queries';
import Loading from './Loading';

// The four positions a member can be recorded with, in the order they are listed.
const POSITIONS = [
  { key: 'Yea', count: 'yea' },
  { key: 'Nay', count: 'nay' },
  { key: 'Present', count: 'present' },
  { key: 'Not Voting', count: 'notVoting' },
];

const PARTIES = [
  { code: 'R', label: 'Republicans', className: 'rep' },
  { code: 'D', label: 'Democrats', className: 'dem' },
  { code: 'I', label: 'Independents', className: 'ind' },
];
const partyClass = code => PARTIES.find(p => p.code === code)?.className ?? 'other';

const STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia', PR: 'Puerto Rico', GU: 'Guam',
  VI: 'Virgin Islands', AS: 'American Samoa', MP: 'Northern Mariana Islands',
};

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// Votes that decide the bill itself come before votes on amendments and procedure.
const decidesBill = vote => !vote.amendment && /passage|motion to concur|suspend the rules and pass|conference report|agreeing to the resolution/i.test(vote.question ?? '');

// Counts by position and party: one row per position that anyone took, one column per party present.
function Breakdown({ vote }) {
  const count = (position, party) => (vote.breakdown ?? [])
    .filter(b => b.position === position && (party == null || b.party === party))
    .reduce((n, b) => n + b.count, 0);
  const parties = PARTIES.filter(p => (vote.breakdown ?? []).some(b => b.party === p.code));
  const rows = POSITIONS.filter(p => vote[p.count] > 0 || p.key === 'Yea' || p.key === 'Nay');
  const decided = vote.yea + vote.nay;
  // A close vote must not print as 50% against 50%: show a decimal when rounding would hide the margin.
  const close = vote.yea !== vote.nay && Math.round((vote.yea / decided) * 100) === Math.round((vote.nay / decided) * 100);
  const percent = n => `${((n / decided) * 100).toFixed(close ? 1 : 0)}%`;
  const largest = Math.max(1, ...rows.map(p => vote[p.count]));
  const largestByParty = Object.fromEntries(parties.map(p => [p.code, Math.max(1, ...rows.map(r => count(r.key, p.code)))]));

  return (
    <table className="vote-breakdown">
      <thead>
        <tr>
          <th />
          <th colSpan={3}>All votes</th>
          {parties.map(p => <th key={p.code}>{p.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map(row => {
          const total = vote[row.count];
          const winning = row.key === 'Yea' ? vote.yea > vote.nay : row.key === 'Nay' && vote.nay > vote.yea;
          return (
            <tr key={row.key} className={winning ? 'leading' : undefined}>
              <th scope="row">{row.key}</th>
              {/* Share of the Yeas and Nays; the other positions decide nothing. */}
              <td className="pct">{(row.key === 'Yea' || row.key === 'Nay') && decided > 0 ? percent(total) : ''}</td>
              <td className="bar">
                <span style={{ width: `${(total / largest) * 100}%` }}>
                  {parties.map(p => (
                    <i key={p.code} className={p.className} style={{ flexGrow: count(row.key, p.code) }} />
                  ))}
                </span>
              </td>
              <td className="num">{total}</td>
              {parties.map(p => {
                const n = count(row.key, p.code);
                return (
                  <td key={p.code} className="party">
                    {n}
                    <i className={p.className} style={{ width: `${(n / largestByParty[p.code]) * 100}%` }} />
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Every member's vote, grouped by state. Fetched when the list is opened.
function Members({ rollCallId }) {
  const { data, loading, error } = useQuery(GET_ROLL_CALL_MEMBERS, { variables: { id: rollCallId } });
  if (loading) return <Loading />;
  if (error) return <div className="error">Failed to load the members: {error.message}</div>;

  const byState = {};
  for (const member of data?.rollCallMembers ?? []) (byState[member.state ?? ''] ??= []).push(member);
  const states = Object.keys(byState).sort((a, b) => (STATES[a] ?? a).localeCompare(STATES[b] ?? b));

  return (
    <div className="vote-members">
      {states.map(state => (
        <table key={state} className="vote-state">
          <caption>{STATES[state] ?? state}</caption>
          <tbody>
            {byState[state].map((member, i) => (
              <tr key={member.bioguideId ?? `${member.name}-${i}`}>
                <td className={`position ${member.position === 'Yea' ? 'yea' : member.position === 'Nay' ? 'nay' : ''}`}>
                  {member.position === 'Not Voting' ? 'No vote' : member.position}
                </td>
                <td className="mono">{member.state}</td>
                <td><span className={`chip ${partyClass(member.party)}`}>{member.party}</span></td>
                <td className="name">
                  {member.personId ? <Link className="person-link" to={`/people/${member.personId}`}>{member.name}</Link> : member.name}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}

function RollCall({ vote }) {
  const [showMembers, setShowMembers] = useState(false);
  const passed = /pass|agreed|confirmed|sustained/i.test(vote.result ?? '') && !/not|reject|fail/i.test(vote.result ?? '');

  return (
    <div className="vote">
      <p className="vote-meta">
        {vote.chamber} · {formatDate(vote.date)} · Roll call {vote.rollNumber}
        {vote.amendment && ` · Amendment ${vote.amendment}`}
      </p>
      <h3>
        {vote.question}
        {vote.result && <span className={`chip ${passed ? 'ok' : 'warn'}`}>{vote.result}</span>}
      </h3>
      {vote.description && <p className="vote-desc">{vote.description}</p>}

      <Breakdown vote={vote} />

      {vote.tieBreaker && (
        <p className="vote-note">Tie broken by the {vote.tieBreaker.by}, who voted {vote.tieBreaker.vote}.</p>
      )}

      <div className="actions">
        <button type="button" className={showMembers ? 'btn active' : 'btn'} aria-expanded={showMembers} onClick={() => setShowMembers(s => !s)}>
          {showMembers ? 'Hide members' : `Show all ${vote.yea + vote.nay + vote.present + vote.notVoting} members`}
        </button>
        {vote.sourceUrl && <a className="btn" href={vote.sourceUrl} target="_blank" rel="noopener noreferrer">Official record ↗</a>}
      </div>
      {showMembers && <Members rollCallId={vote.id} />}
    </div>
  );
}

/** The recorded votes on a bill: those deciding the bill first, then amendments and procedure, newest first. */
export default function BillVotes({ rollCalls }) {
  const ordered = [...rollCalls].sort((a, b) => Number(decidesBill(b)) - Number(decidesBill(a)));
  return (
    <div className="votes">
      {ordered.map(vote => <RollCall key={vote.id} vote={vote} />)}
    </div>
  );
}
