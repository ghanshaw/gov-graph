import { useMutation, useQuery } from '@apollo/client/react';
import { ADD_FAVORITE, GET_FAVORITES, GET_FAVORITE_STATE, REMOVE_FAVORITE } from '../queries';

// ☆ / ★ in an item page's row of buttons (itemRef: "bill:119-HR-1", see server/tags.js).
// Hidden when the server has no current user (CURRENT_USER_ID unset).
export default function FavoriteButton({ itemRef }) {
  const variables = { ref: itemRef };
  const { data } = useQuery(GET_FAVORITE_STATE, { variables });
  const options = {
    variables,
    refetchQueries: [{ query: GET_FAVORITES }],
    // The answer is the new state; write it straight into the cache so the star flips at once.
    update(cache, { data: result }) {
      const isFavorite = result?.addFavorite ?? result?.removeFavorite;
      const current = cache.readQuery({ query: GET_FAVORITE_STATE, variables });
      if (current) cache.writeQuery({ query: GET_FAVORITE_STATE, variables, data: { ...current, isFavorite } });
    },
  };
  const [add, { loading: adding }] = useMutation(ADD_FAVORITE, options);
  const [remove, { loading: removing }] = useMutation(REMOVE_FAVORITE, options);

  if (!data?.me) return null;
  const on = data.isFavorite;
  return (
    <button
      type="button"
      className={on ? 'btn active favorite' : 'btn favorite'}
      aria-pressed={on}
      disabled={adding || removing}
      onClick={() => (on ? remove() : add())}
    >
      <span aria-hidden="true">{on ? '★' : '☆'}</span> {on ? 'In favorites' : 'Add to favorites'}
    </button>
  );
}
