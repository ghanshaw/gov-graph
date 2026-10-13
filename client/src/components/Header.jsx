import { Link, useLocation } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Presidents' },
  { to: '/executive-orders', label: 'Executive Orders' },
  { to: '/supreme-court', label: 'Supreme Court' },
  { to: '/congress', label: 'Congress' },
  { to: '/code', label: 'U.S. Code' },
  { to: '/reports', label: 'Reports' },
  { to: '/people', label: 'People' },
  { to: '/demographics', label: 'Demographics' },
  { to: '/timeline', label: 'Timeline' },
  { to: '/economy', label: 'Economic Data' },
  { to: '/corpus', label: 'Corpus' },
  { to: '/case-graph', label: 'Case Graph' },
  { to: '/sources', label: 'Sources' },
  { to: '/tags', label: 'Tags' },
];

export default function Header() {
  const { pathname } = useLocation();

  return (
    <header className="top">
      <div className="top-inner">
        <Link className="brand" to="/">GovLens <span>Public Records</span></Link>
        <nav>
          {NAV.map(({ to, label }) => {
            // President pages live at the root (/:slug/…), so "Presidents" is whatever no other item claims.
            const active = to === '/'
              ? !NAV.some(item => item.to !== '/' && pathname.startsWith(item.to))
              : pathname.startsWith(to);
            return <Link key={to} to={to} className={active ? 'on' : undefined}>{label}</Link>;
          })}
        </nav>
      </div>
    </header>
  );
}
