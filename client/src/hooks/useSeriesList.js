import { useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_SERIES_LIST } from '../queries';

/**
 * Every economic series stored (no values), fetched once and kept by Apollo: { list, bySlug, nameOf, loading }.
 * `nameOf(slug)` is the series' stored name, the one name it is shown by everywhere (NAMING.md); a pair
 * offered as one choice is named by its tab entry instead.
 */
export default function useSeriesList() {
  const { data, loading } = useQuery(GET_SERIES_LIST);
  return useMemo(() => {
    const list = data?.economicSeriesList ?? [];
    const bySlug = new Map(list.map(s => [s.slug, s]));
    return { list, bySlug, nameOf: slug => bySlug.get(slug)?.name ?? '', loading };
  }, [data, loading]);
}
