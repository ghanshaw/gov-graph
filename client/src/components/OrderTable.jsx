import { Link } from 'react-router-dom';
import { shortDate } from '../dates';

const PRESIDENT_DISPLAY = {
  'barack-obama': 'Obama',
  'donald-trump': 'Trump (45th)',
  'donald-trump-47': 'Trump (47th)',
  'joseph-biden': 'Biden',
};

// Presidential documents as rows, with a separator wherever the signing year changes.
// slugFor(order) gives the president slug used in the order's link. `counts` (year → count)
// is optional and adds the year's total to its separator.
export default function OrderTable({ orders, slugFor, docType, showPresident = false, newestFirst = true, counts }) {
  const columns = showPresident ? 4 : 3;
  // Memoranda have no number of their own; they are cited by Federal Register page ("82 FR 7629").
  const numbered = orders.some(order => order.number);
  const rows = [];
  let lastYear;

  orders.forEach(order => {
    if (order.year !== lastYear) {
      lastYear = order.year;
      const count = counts?.[order.year];
      rows.push(
        <tr key={`year-${order.year}`} className="year-row">
          <td colSpan={columns}>
            {order.year ?? 'Undated'}
            {count != null && ` · ${count.toLocaleString()} ${count === 1 ? 'document' : 'documents'}`}
          </td>
        </tr>
      );
    }
    const slug = slugFor(order);
    rows.push(
      <tr key={order.number || order.documentNumber || order.title}>
        <td className="no nowrap">{order.number ?? order.citation ?? '—'}</td>
        <td className="title">
          {/* Documents without an order number (memoranda) are addressed by Federal Register document number. */}
          {order.number
            ? <Link to={`/${slug}/${docType}/eo/${order.number}`}>{order.title}</Link>
            : <Link to={`/${slug}/${docType}/doc/${order.documentNumber}`}>{order.title}</Link>}
        </td>
        {showPresident && <td className="meta nowrap wide-only">{PRESIDENT_DISPLAY[slug] || slug}</td>}
        <td className="date">{shortDate(order.dateSigned)}</td>
      </tr>
    );
  });

  return (
    <table className="records">
      <thead>
        <tr>
          <th>{numbered || orders.length === 0 ? 'No.' : 'Citation'}</th>
          <th>Title</th>
          {showPresident && <th className="wide-only">President</th>}
          <th className={newestFirst ? 'date sorted' : 'date sorted asc'}>Signed</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  );
}
