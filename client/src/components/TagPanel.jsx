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
    <div style={{
      marginTop: '2rem',
      paddingTop: '1.5rem',
      borderTop: '1px solid rgba(201,168,76,0.15)',
    }}>
      <div style={{ color: 'var(--gold)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
        Tags
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        {tags.map(tag => (
          <span key={tag.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)',
            borderRadius: '3px', padding: '0.2rem 0.5rem',
            fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.75rem', color: 'var(--gold)',
          }}>
            <Link to={`/tags/${tag.word}`} style={{ color: 'inherit', textDecoration: 'none' }}>
              {tag.word}
            </Link>
            <button
              onClick={() => removeTag({ variables: { word: tag.word, entityType, entityId } })}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(201,168,76,0.5)', padding: 0, lineHeight: 1, fontSize: '0.9rem',
              }}
              aria-label={`Remove tag ${tag.word}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="add tag…"
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(201,168,76,0.2)',
            borderRadius: '3px', padding: '0.3rem 0.6rem',
            fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.75rem',
            color: 'var(--cream)', outline: 'none', width: '12rem',
          }}
        />
        <button type="submit" style={{
          background: 'var(--gold)', border: 'none', borderRadius: '3px',
          padding: '0.3rem 0.75rem', fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '0.75rem', color: 'var(--navy)', cursor: 'pointer', fontWeight: 600,
        }}>
          Tag
        </button>
      </form>
    </div>
  );
}
