import { useEffect, useMemo, useRef, useState } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { GET_ECONOMIC_SERIES } from '../queries';

/**
 * The values of each series asked for, fetched one by one as they are added (each whole, resampled as
 * `resampleOf(slug)` says: 'week' for daily series shown as weekly averages, null otherwise) and kept:
 * { data: Map slug → series, loading: Set of slugs asked for and not yet here }. Adding a series
 * fetches only that one.
 */
export default function useSeriesData(slugs, resampleOf) {
  const client = useApolloClient();
  const requested = useRef(new Set());
  const [data, setData] = useState(() => new Map());
  const [failed, setFailed] = useState(() => new Set());
  const key = [...new Set(slugs)].sort().join(',');

  useEffect(() => {
    for (const slug of key ? key.split(',') : []) {
      if (requested.current.has(slug)) continue;
      requested.current.add(slug);
      client.query({ query: GET_ECONOMIC_SERIES, variables: { slug, resample: resampleOf(slug) } })
        .then(({ data: d }) => setData(prev => new Map(prev).set(slug, d.economicSeries)))
        .catch(err => { console.error(`series ${slug}:`, err); setFailed(prev => new Set(prev).add(slug)); });
    }
  }, [key, client]); // eslint-disable-line react-hooks/exhaustive-deps

  const loading = useMemo(() => new Set((key ? key.split(',') : []).filter(s => !data.has(s) && !failed.has(s))), [key, data, failed]);
  return { data, loading };
}
