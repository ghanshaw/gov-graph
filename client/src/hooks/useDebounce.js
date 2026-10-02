import { useState, useRef, useCallback } from 'react';

// Returns [debounced, update]: calling update(value) sets `debounced` once `delay` ms
// have passed without another call.
export default function useDebounce(initial, delay) {
  const [debounced, setDebounced] = useState(initial);
  const timeout = useRef(null);

  const update = useCallback((value) => {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setDebounced(value), delay);
  }, [delay]);

  return [debounced, update];
}
