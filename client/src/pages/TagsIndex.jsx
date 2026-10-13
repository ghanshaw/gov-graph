import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_TAGS } from '../queries';
import PageLayout from '../components/PageLayout';
import { RailGroup, Fact } from '../components/Rail';
import Loading from '../components/Loading';

export default function TagsIndex() {
  const { data, loading } = useQuery(GET_TAGS);
  const tags = data?.tags || [];
  const tagged = tags.reduce((sum, tag) => sum + tag.count, 0);

  const rail = (
    <>
      <RailGroup title="Tags">
        <Fact label="Tags">{loading ? '…' : tags.length}</Fact>
        <Fact label="Tagged items">{loading ? '…' : tagged}</Fact>
      </RailGroup>
      <RailGroup title="Adding tags">
        <p>Tags are applied from an item’s page: an order, memorandum, bill, decision, U.S. Code section or report.</p>
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

      {loading && <Loading />}

      {!loading && tags.length === 0 && (
        <div className="state">No tags yet. Apply tags from an item’s page.</div>
      )}

      {tags.length > 0 && (
        <table className="records">
          <thead>
            <tr>
              <th>Tag</th>
              <th>Description</th>
              <th className="date">Items</th>
            </tr>
          </thead>
          <tbody>
            {tags.map(tag => (
              <tr key={tag.word}>
                <td className="title"><Link to={`/tags/${tag.word}`}>{tag.word}</Link></td>
                <td className="meta">{tag.description}</td>
                <td className="date">{tag.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageLayout>
  );
}
