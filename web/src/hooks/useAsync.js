import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an async function and tracks loading / data / error.
 *
 * Every screen needs the same three states, and writing them by hand each time
 * is how one of them ends up missing. `reload` lets a screen refresh after a
 * mutation without re-mounting.
 *
 * @template T
 * @param {() => Promise<T>} asyncFn  Re-run whenever its identity changes, so
 *   wrap it in `useCallback` with the values it depends on.
 * @param {{ enabled?: boolean }} [options]
 * @returns {{ data: T | null, error: Error | null, loading: boolean, reload: () => void }}
 */
export function useAsync(asyncFn, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled });
  const [reloadToken, setReloadToken] = useState(0);

  // Guards against a slow first request resolving after a faster second one and
  // overwriting newer data with older.
  const requestId = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, error: null, loading: false });
      return undefined;
    }

    const id = requestId.current + 1;
    requestId.current = id;
    let cancelled = false;

    setState((current) => ({ ...current, loading: true, error: null }));

    asyncFn()
      .then((data) => {
        if (!cancelled && requestId.current === id) {
          setState({ data, error: null, loading: false });
        }
      })
      .catch((error) => {
        if (!cancelled && requestId.current === id) {
          setState({ data: null, error, loading: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [asyncFn, enabled, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { ...state, reload };
}
