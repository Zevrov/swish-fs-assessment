import { useEffect, useState } from 'react';
import { FilterOptions } from '../types';
import { api } from '../services/api';

const EMPTY: FilterOptions = { positions: [], statTypes: [], suspensionStatuses: [] };

// Fetched once at app start. Lifted out of MarketFilters so MarketTabs and
// MarketFilters can share the same list without doing two round-trips.
export const useFilterOptions = (): FilterOptions => {
  const [options, setOptions] = useState<FilterOptions>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api.getFilterOptions();
        if (!cancelled) setOptions(result);
      } catch (error) {
        console.error('Error loading filter options:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return options;
};
