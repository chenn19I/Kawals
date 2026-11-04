import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError, fetchHealth, type ApiHealth } from '../lib/api';

export function useHealth(intervalMs = 30_000): {
  health: ApiHealth | null;
  error: ApiRequestError | null;
  loading: boolean;
  refresh: () => void;
} {
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const aliveRef = useRef(true);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    aliveRef.current = true;

    const load = async (): Promise<void> => {
      try {
        const next = await fetchHealth(controller.signal);
        if (!aliveRef.current) return;
        setHealth(next);
        setError(null);
      } catch (caught) {
        if (
          !aliveRef.current ||
          (caught instanceof DOMException && caught.name === 'AbortError')
        ) {
          return;
        }
        setHealth(null);
        setError(
          caught instanceof ApiRequestError
            ? caught
            : new ApiRequestError(0, 'NETWORK', 'The Kawal API cannot be reached.'),
        );
      } finally {
        if (aliveRef.current) setLoading(false);
      }
    };

    void load();
    const timer = window.setInterval(load, intervalMs);
    return () => {
      aliveRef.current = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [intervalMs, tick]);

  return { health, error, loading, refresh };
}
