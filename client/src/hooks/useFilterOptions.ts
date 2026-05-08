import { useCallback, useEffect, useState } from 'react';
import { FilterOptions } from '../types';
import { api } from '../services/api';

const EMPTY: FilterOptions = { positions: [], statTypes: [], suspensionStatuses: [] };

interface UseFilterOptionsResult {
  filterOptions: FilterOptions;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

// Fetched once at app start (with explicit retry). Lifted out of
// MarketFilters so MarketTabs and MarketFilters can share the same list
// without two round-trips. Errors are surfaced to the caller instead of
// being silently swallowed — empty dropdowns are a poor UX signal.
export const useFilterOptions = (): UseFilterOptionsResult => {
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getFilterOptions()
      .then((result) => {
        if (!cancelled) setFilterOptions(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load filter options';
        console.error('Error loading filter options:', err);
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { filterOptions, loading, error, retry };
};
