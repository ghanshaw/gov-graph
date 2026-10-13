import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import { GET_TAGS, GET_TAGS_FOR_ITEM, CREATE_TAG, APPLY_TAG, REMOVE_TAG } from '../queries';
import { normalizeWord, nearMatches } from '../tags';

// The tags on one item (itemRef: "bill:119-HR-1", see server/tags.js). Typing offers existing tags;
// a word that is not a tag yet must be created on purpose, after seeing the tags it is close to.
export default function TagPanel({ itemRef }) {
  const [input, setInput] = useState('');
  const refetchQueries = [{ query: GET_TAGS_FOR_ITEM, variables: { ref: itemRef } }, { query: GET_TAGS }];

  const { data } = useQuery(GET_TAGS_FOR_ITEM, { variables: { ref: itemRef } });
  const { data: all } = useQuery(GET_TAGS);
  const [applyTag] = useMutation(APPLY_TAG, { refetchQueries });
  const [removeTag] = useMutation(REMOVE_TAG, { refetchQueries });
  const [createTag] = useMutation(CREATE_TAG);

  const applied = data?.tagsForItem ?? [];
  const appliedWords = new Set(applied.map(t => t.word));
  const words = (all?.tags ?? []).map(t => t.word).filter(w => !appliedWords.has(w));

  const word = normalizeWord(input);
  const exists = (all?.tags ?? []).some(t => t.word === word);
  // Existing tags containing what is typed, those starting with it first.
  const matches = word
    ? words.filter(w => w.includes(word)).sort((a, b) => b.startsWith(word) - a.startsWith(word) || a.localeCompare(b)).slice(0, 8)
    : [];
  const near = word && !exists ? nearMatches(word, words).filter(w => !matches.includes(w)) : [];

  function apply(w) {
    applyTag({ variables: { word: w, ref: itemRef } });
    setInput('');
  }

  async function create() {
    await createTag({ variables: { word } });
    apply(word);
  }

  // Enter applies the word if it is a tag, or the only tag that matches; it never creates one.
  function handleSubmit(e) {
    e.preventDefault();
    if (exists && !appliedWords.has(word)) apply(word);
    else if (matches.length === 1) apply(matches[0]);
  }

  return (
    <div className="panel">
      <h3>Tags</h3>

      {applied.length > 0 && (
        <div className="chips">
          {applied.map(tag => (
            <span key={tag.id} className="chip accent">
              <Link to={`/tags/${tag.word}`}>{tag.word}</Link>
              <button
                type="button"
                onClick={() => removeTag({ variables: { word: tag.word, ref: itemRef } })}
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
          aria-label="Tag"
        />
        <button type="submit" className="btn primary" disabled={!exists && matches.length !== 1}>Tag</button>
      </form>

      {matches.length > 0 && (
        <div className="tag-suggest">
          {matches.map(w => (
            <button key={w} type="button" className="chip" onClick={() => apply(w)}>{w}</button>
          ))}
        </div>
      )}

      {word && !exists && (
        <div className="tag-suggest">
          {near.length > 0 && (
            <>
              <span className="hint">Did you mean</span>
              {near.map(w => (
                <button key={w} type="button" className="chip" onClick={() => apply(w)}>{w}</button>
              ))}
            </>
          )}
          <button type="button" className="btn small" onClick={create}>Create tag “{word}”</button>
        </div>
      )}
    </div>
  );
}
