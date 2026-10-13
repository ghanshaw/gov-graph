import { Link } from 'react-router-dom';
import { shortDate } from '../dates';

// Bill lists (session page, search results): one row per proposal, i.e. a bill, or an identical
// House and Senate bill together.

export const TYPE_CODE = {
  HR: 'H.R.', S: 'S.', HJRES: 'H.J.Res.', SJRES: 'S.J.Res.',
  HCONRES: 'H.Con.Res.', SCONRES: 'S.Con.Res.', HRES: 'H.Res.', SRES: 'S.Res.',
};

const PARTY_CLASS = { D: 'party-dem', R: 'party-rep', I: 'party-ind' };

export const billCode = bill => `${TYPE_CODE[bill.type] || bill.type} ${bill.number}`;
const billPath = bill => `/congress/${bill.congress}/${bill.type.toLowerCase()}/${bill.number}`;
const ordinal = n => `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

function Sponsor({ sponsor }) {
  return (
    <>
      {sponsor.personId
        ? <Link className="person-link" to={`/people/${sponsor.personId}`}>{sponsor.fullName}</Link>
        : sponsor.fullName}
      {/* Congress.gov's names already end "[D-GA-13]". */}
      {sponsor.party && !/\[/.test(sponsor.fullName ?? '') && (
        <span className={PARTY_CLASS[sponsor.party]}> ({sponsor.party}-{sponsor.state})</span>
      )}
    </>
  );
}

// The earlier bill of a pair leads. Each bill keeps its own sponsor and latest action, since the
// two move separately. In search results, `matchedTitle` is the title the search found when it is
// not the bill's own (a popular or short title, or a name we added), with its type as published;
// `showCongress` adds the Congress under the numbers, for results from several.
export function BillRow({ bill, showCongress = false }) {
  const members = [bill, ...(bill.companions ?? [])];
  const paired = members.length > 1;
  const truncate = value => (value && value.length > 120 ? value.slice(0, 120) + '…' : value);

  return (
    <tr>
      <td className="no">
        {members.map(m => <Link key={m.id} className="bill-code" to={billPath(m)}>{billCode(m)}</Link>)}
        {showCongress && <span className="sub">{ordinal(bill.congress)} Congress</span>}
      </td>
      <td className="title">
        <Link to={billPath(bill)}>{bill.title || 'Untitled Bill'}</Link>
        {bill.matchedTitle && (
          <span className="sub matched-title">{bill.matchedTitleType ?? 'Title'}: <b>{bill.matchedTitle}</b></span>
        )}
        {/* One line per bill's sponsor ("Rep." / "Sen." tells the chambers apart). */}
        {members.filter(m => m.sponsor).map(m => (
          <span key={m.id} className="sub"><Sponsor sponsor={m.sponsor} /></span>
        ))}
        {members.filter(m => m.latestActionText).map(m => (
          <span key={m.id} className="sub">
            {paired && <span className="bill-label">{billCode(m)}: </span>}
            {truncate(m.latestActionText)}
          </span>
        ))}
      </td>
      <td className="wide-only">{bill.policyArea && <span className="chip">{bill.policyArea}</span>}</td>
      <td className="date">{shortDate(bill.introducedDate)}</td>
    </tr>
  );
}

export function BillTable({ bills, showCongress = false }) {
  return (
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
        {bills.map(bill => <BillRow key={bill.id} bill={bill} showCongress={showCongress} />)}
      </tbody>
    </table>
  );
}
