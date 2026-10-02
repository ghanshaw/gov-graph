import { Link } from 'react-router-dom';

export default function TimelineView({ orders, slug, docType, newestFirst = false }) {
  const byYear = orders.reduce((acc, order) => {
    const y = order.year || 'Unknown';
    if (!acc[y]) acc[y] = [];
    acc[y].push(order);
    return acc;
  }, {});

  // Orders arrive already sorted; the year groups follow the same direction.
  const years = Object.keys(byYear).sort((a, b) => (newestFirst ? b - a : a - b));

  return (
    <div className="tl">
      {years.map(year => (
        <div key={year} className="tl-group">
          <div className="tl-year">
            <h2>{year}</h2>
            <span>{byYear[year].length} order{byYear[year].length !== 1 ? 's' : ''}</span>
          </div>

          {byYear[year].map(order => (
            <Link key={order.number || order.title} to={`/${slug}/${docType}/eo/${order.number}`} className="tl-row">
              <span className="no">{order.number}</span>
              <span className="title">{order.title}</span>
              {order.dateSigned && (
                <span className="date">
                  {new Date(order.dateSigned + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}
