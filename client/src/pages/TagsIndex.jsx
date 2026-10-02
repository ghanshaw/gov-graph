import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_ALL_TAGS } from '../queries';
import PageLayout from '../components/PageLayout';
import { RailGroup, Fact } from '../components/Rail';

export default function TagsIndex() {
  const { data, loading } = useQuery(GET_ALL_TAGS);
  const tags = data?.allTags || [];
  const tagged = tags.reduce((sum, tag) => sum + tag.count, 0);

  const rail = (
    <>
      <RailGroup title="Tags">
        <Fact label="Tags">{loading ? '…' : tags.length}</Fact>
        <Fact label="Tagged documents">{loading ? '…' : tagged}</Fact>
      </RailGroup>
      <RailGroup title="Adding tags">
        <p>Tags are applied from an order, case or bill page.</p>
      </RailGroup>
    </>
  );

  return (
    <PageLayout rail={rail}>
      <div className="page-head">
        <h1 className="page-title">
          Tags
          {!loading && <small>{tags.length} {tags.length === 1 ? 'tag' : 'tags'}</small>}
        </h1>
      </div>

      {loading && <div className="state">Loading…</div>}

      {!loading && tags.length === 0 && (
        <div className="state">No tags yet. Apply tags from individual document pages.</div>
      )}

      {tags.length > 0 && (
        <table className="records">
          <thead>
            <tr>
              <th>Tag</th>
              <th className="date">Documents</th>
            </tr>
          </thead>
          <tbody>
            {tags.map(tag => (
              <tr key={tag.word}>
                <td className="title"><Link to={`/tags/${tag.word}`}>{tag.word}</Link></td>
                <td className="date">{tag.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageLayout>
  );
}
