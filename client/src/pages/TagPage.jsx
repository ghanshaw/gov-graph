import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import { GET_TAG_PAGE, GET_TAGS, DESCRIBE_TAG, MERGE_TAG, DELETE_TAG } from '../queries';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import { RailGroup, Fact } from '../components/Rail';
import Loading from '../components/Loading';
import { shortDate } from '../dates';

// Item kinds (server/tags.js) in the order they are listed.
const KINDS = [
  { kind: 'eo', heading: 'Executive orders' },
  { kind: 'memo', heading: 'Memoranda' },
  { kind: 'bill', heading: 'Bills and laws' },
  { kind: 'scotus', heading: 'Supreme Court' },
  { kind: 'usc', heading: 'U.S. Code' },
  { kind: 'report', heading: 'Reports' },
  { kind: null, heading: 'Not stored' },
];

function Description({ tag }) {
  const [text, setText] = useState(tag.description ?? '');
  useEffect(() => setText(tag.description ?? ''), [tag.description]);
  const [describe, { loading }] = useMutation(DESCRIBE_TAG);
  const changed = text.trim() !== (tag.description ?? '');
  return (
    <form className="tag-describe" onSubmit={e => { e.preventDefault(); describe({ variables: { word: tag.word, description: text } }); }}>
      <textarea
        className="rail-select"
        rows={3}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="What belongs under this tag"
        aria-label="Description"
      />
      {changed && <button type="submit" className="btn small" disabled={loading}>Save</button>}
    </form>
  );
}

// Moves every item to another tag and deletes this one. Two clicks, no browser dialog.
function Merge({ tag }) {
  const navigate = useNavigate();
  const { data } = useQuery(GET_TAGS);
  const others = (data?.tags ?? []).filter(t => t.word !== tag.word);
  const [into, setInto] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [merge, { loading }] = useMutation(MERGE_TAG, {
    refetchQueries: [{ query: GET_TAGS }],
    onCompleted: () => navigate(`/tags/${into}`),
  });
  if (!others.length) return null;
  return (
    <RailGroup title="Merge">
      <p>Move this tag’s items to another tag and delete “{tag.word}”.</p>
      <select className="rail-select" value={into} onChange={e => { setInto(e.target.value); setConfirming(false); }} aria-label="Merge into">
        <option value="">Merge into…</option>
        {others.map(t => <option key={t.word} value={t.word}>{t.word} ({t.count})</option>)}
      </select>
      {into && (
        <div className="tag-actions">
          {confirming
            ? <button type="button" className="btn small primary" disabled={loading} onClick={() => merge({ variables: { from: tag.word, into } })}>Merge into “{into}”</button>
            : <button type="button" className="btn small" onClick={() => setConfirming(true)}>Merge…</button>}
        </div>
      )}
    </RailGroup>
  );
}

function Delete({ tag }) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [remove, { loading }] = useMutation(DELETE_TAG, {
    refetchQueries: [{ query: GET_TAGS }],
    onCompleted: () => navigate('/tags'),
  });
  return (
    <RailGroup title="Delete">
      <p>This tag is on no items.</p>
      {confirming
        ? <button type="button" className="btn small primary" disabled={loading} onClick={() => remove({ variables: { word: tag.word } })}>Delete “{tag.word}”</button>
        : <button type="button" className="btn small" onClick={() => setConfirming(true)}>Delete…</button>}
    </RailGroup>
  );
}

export default function TagPage() {
  const { word } = useParams();
  const { data, loading } = useQuery(GET_TAG_PAGE, { variables: { word } });
  const tag = data?.tagPage?.tag;
  const items = data?.tagPage?.items ?? [];
  const groups = KINDS.map(k => ({ ...k, items: items.filter(i => i.kind === k.kind) })).filter(g => g.items.length);

  const rail = tag && (
    <>
      <RailGroup title="Tagged">
        {groups.length ? groups.map(g => <Fact key={g.heading} label={g.heading}>{g.items.length}</Fact>) : <p>Nothing yet.</p>}
      </RailGroup>
      <RailGroup title="Description">
        <Description tag={tag} />
      </RailGroup>
      <Merge key={tag.word} tag={tag} />
      {items.length === 0 && <Delete key={`delete-${tag.word}`} tag={tag} />}
    </>
  );

  return (
    <PageLayout rail={rail}>
      <Crumbs items={[{ label: 'Tags', to: '/tags' }, { label: word }]} />
      <div className="page-head">
        <h1 className="page-title">
          {word}
          {tag && <small>{items.length} {items.length === 1 ? 'item' : 'items'}</small>}
        </h1>
      </div>
      {tag?.description && <p className="lede">{tag.description}</p>}

      {loading && <Loading />}

      {!loading && !tag && <div className="state">No tag “{word}”.</div>}

      {tag && items.length === 0 && <div className="state">Nothing is tagged “{word}” yet. Tags are applied from an item’s page.</div>}

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
                    {item.note && <span className="sub">{item.note}</span>}
                  </td>
                  <td className="date">{shortDate(item.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </PageLayout>
  );
}
