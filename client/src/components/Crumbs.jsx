import { Fragment } from 'react';
import { Link } from 'react-router-dom';

// items: [{ label, to }]; the last one is the current page and is not a link.
export default function Crumbs({ items }) {
  return (
    <div className="crumbs">
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && ' / '}
          {item.to && i < items.length - 1 ? <Link to={item.to}>{item.label}</Link> : item.label}
        </Fragment>
      ))}
    </div>
  );
}
