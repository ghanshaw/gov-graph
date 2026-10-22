import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client/react';
import { GET_FAVORITES, REMOVE_FAVORITE } from '../queries';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import { RailGroup, Fact } from '../components/Rail';
import Loading from '../components/Loading';
import { shortDate } from '../dates';

// Item kinds (server/tags.js) in the order they are listed, as on a tag page.
const KINDS = [
  { kind: 'eo', heading: 'Executive orders' },
  { kind: 'memo', heading: 'Memoranda' },
  { kind: 'bill', heading: 'Bills and laws' },
  { kind: 'scotus', heading: 'Supreme Court' },
  { kind: 'usc', heading: 'U.S. Code' },
  { kind: 'report', heading: 'Reports' },
  { kind: null, heading: 'Not stored' },
];

function Remove({ itemRef }) {
  const [remove, { loading }] = useMutation(REMOVE_FAVORITE, {
    variables: { ref: itemRef },
    refetchQueries: [{ query: GET_FAVORITES }],
  });
  return (
    <button type="button" className="btn small favorite-remove" disabled={loading} onClick={() => remove()} aria-label="Remove from favorites" title="Remove from favorites">
      ★
    </button>
  );
}

// The current user's favorites, grouped by kind, most recently added first within each.
export default function Favorites() {
  const { data, loading } = useQuery(GET_FAVORITES, { fetchPolicy: 'cache-and-network' });
  const me = data?.me;
  const items = data?.favorites ?? [];
  const groups = KINDS.map(k => ({ ...k, items: items.filter(i => i.kind === k.kind) })).filter(g => g.items.length);

  const rail = me && (
    <RailGroup title="Favorites">
      {groups.length ? groups.map(g => <Fact key={g.heading} label={g.heading}>{g.items.length}</Fact>) : <p>Nothing yet.</p>}
    </RailGroup>
  );

  return (
    <PageLayout rail={rail}>
      <Crumbs items={[{ label: 'Favorites' }]} />
      <div className="page-head">
        <h1 className="page-title">
          Favorites
          {me && <small>{items.length} {items.length === 1 ? 'item' : 'items'}</small>}
        </h1>
      </div>

      {loading && !data && <Loading />}

      {data && !me && (
        <div className="state">No user is set. Create one with <code>server/seed/create-user.js</code> and put its id in <code>server/.env</code> as <code>CURRENT_USER_ID</code>.</div>
      )}

      {me && items.length === 0 && <div className="state">No favorites yet. Add one with ☆ on an order, bill, decision, Code section or report.</div>}

      {groups.map(g => (
        <div key={g.heading} className="page-section">
          <h2 className="section-title">{g.heading}</h2>
          <table className="records">
            <tbody>
              {g.items.map(item => (
                <tr key={item.ref}>
                  <td className="no">{item.label ?? item.ref}</td>
                  <td className="title">
                    {item.href ? <Link to={item.href}>{item.title || item.label}</Link> : (item.title || item.ref)}
                    <span className="sub">Added {shortDate(item.favoritedAt.slice(0, 10))}</span>
                  </td>
                  <td className="date">{shortDate(item.date)}</td>
                  <td className="favorite-cell"><Remove itemRef={item.ref} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </PageLayout>
  );
}
