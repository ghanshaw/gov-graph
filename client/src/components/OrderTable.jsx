import { Link } from 'react-router-dom';

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
      <tr key={order.number || order.url || order.title}>
        <td className="no">{order.number ?? '—'}</td>
        <td className="title">
          {/* Documents without an order number (memoranda) have no page here. */}
          {order.number
            ? <Link to={`/${slug}/${docType}/eo/${order.number}`}>{order.title}</Link>
            : <a href={order.url} target="_blank" rel="noopener noreferrer">{order.title}</a>}
        </td>
        {showPresident && <td className="meta nowrap wide-only">{PRESIDENT_DISPLAY[slug] || slug}</td>}
        <td className="date">{order.dateSigned ?? ''}</td>
      </tr>
    );
  });

  return (
    <table className="records">
      <thead>
        <tr>
          <th>No.</th>
          <th>Title</th>
          {showPresident && <th className="wide-only">President</th>}
          <th className={newestFirst ? 'date sorted' : 'date sorted asc'}>Signed</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  );
}
