import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_ALL_TAGS } from '../queries';

export default function TagsIndex() {
  const { data, loading } = useQuery(GET_ALL_TAGS);
  const tags = data?.allTags || [];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.7rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          Tags
        </div>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '2rem', color: 'var(--cream)', margin: 0 }}>
          All Tags
        </h1>
      </div>

      {loading && <div style={{ color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.8rem' }}>Loading…</div>}

      {!loading && tags.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.85rem' }}>
          No tags yet. Apply tags from individual document pages.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {tags.map(tag => (
          <Link
            key={tag.word}
            to={`/tags/${tag.word}`}
            style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              padding: '0.85rem 0',
              borderBottom: '1px solid rgba(201,168,76,0.1)',
              textDecoration: 'none',
              color: 'var(--cream)',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--gold)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--cream)'}
          >
            <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.1rem' }}>{tag.word}</span>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {tag.count} {tag.count === 1 ? 'entity' : 'entities'}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
