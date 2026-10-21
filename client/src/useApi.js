import { useCallback, useEffect, useState } from 'react';

// Loads data for a page. Keeps the previous data while reloading so admin actions don't flash a skeleton.
export function useApi(load, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  // `deps` decides when to refetch, like a useEffect dependency list
  const run = useCallback(load, deps);

  const reload = useCallback(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    run().then(
      (data) => { if (alive) setState({ data, error: null, loading: false }); },
      (error) => { if (alive) setState({ data: null, error, loading: false }); },
    );
    return () => { alive = false; };
  }, [run]);

  useEffect(() => reload(), [reload]);
  return { ...state, reload };
}
