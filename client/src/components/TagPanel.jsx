import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import { GET_TAGS_FOR_ENTITY, APPLY_TAG, REMOVE_TAG } from '../queries';

export default function TagPanel({ entityType, entityId }) {
  const [input, setInput] = useState('');

  const { data, refetch } = useQuery(GET_TAGS_FOR_ENTITY, {
    variables: { entityType, entityId },
  });

  const [applyTag] = useMutation(APPLY_TAG, {
    onCompleted: () => refetch(),
  });

  const [removeTag] = useMutation(REMOVE_TAG, {
    onCompleted: () => refetch(),
  });

  const tags = data?.tagsForEntity || [];

  function handleSubmit(e) {
    e.preventDefault();
    const word = input.trim().toLowerCase();
    if (!word) return;
    applyTag({ variables: { word, entityType, entityId } });
    setInput('');
  }

  return (
    <div className="panel">
      <h3>Tags</h3>

      {tags.length > 0 && (
        <div className="chips">
          {tags.map(tag => (
            <span key={tag.id} className="chip accent">
              <Link to={`/tags/${tag.word}`}>{tag.word}</Link>
              <button
                type="button"
                onClick={() => removeTag({ variables: { word: tag.word, entityType, entityId } })}
                aria-label={`Remove tag ${tag.word}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <form className="tag-form" onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="add tag…"
        />
        <button type="submit" className="btn primary">Tag</button>
      </form>
    </div>
  );
}
