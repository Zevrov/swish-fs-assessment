import React, { useState, useEffect, useRef } from 'react';
import { Filters, FilterOptions } from '../types';

interface Props {
  filters: Filters;
  filterOptions: FilterOptions;
  onFiltersChange: (filters: Filters) => void;
}

const SEARCH_DEBOUNCE_MS = 300;

export const MarketFilters: React.FC<Props> = ({ filters, filterOptions, onFiltersChange }) => {
  // Local input state lets the field feel instant while we debounce the
  // upstream filter update (and the fetch it triggers).
  const [searchInput, setSearchInput] = useState(filters.search);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Keep the input in sync if the parent clears/replaces filters externally.
  useEffect(() => {
    if (filters.search !== searchInput) {
      setSearchInput(filters.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  // Debounce: propagate the search term up after the user pauses typing.
  useEffect(() => {
    if (searchInput === filtersRef.current.search) return;
    const handle = setTimeout(() => {
      onFiltersChange({ ...filtersRef.current, search: searchInput });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput, onFiltersChange]);

  const handleFilterChange = (key: keyof Filters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  return (
    <div className="filters-container">
      <h3>Filters</h3>

      <div className="filters-grid">
        {/* Player / Team search */}
        <div className="filter-group">
          <label className="form-label" htmlFor="market-search">
            Search:
          </label>
          <input
            id="market-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Player or team"
            className="form-input"
            autoComplete="off"
          />
        </div>

        {/* Position Filter */}
        <div className="filter-group">
          <label className="form-label">Position:</label>
          <select
            value={filters.position}
            onChange={(e) => handleFilterChange('position', e.target.value)}
            className="form-select"
          >
            <option value="">All Positions</option>
            {filterOptions.positions.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
        </div>

        {/* Stat Type is now driven by MarketTabs above the table. */}

        <div className="filter-group">
          <label className="form-label">Market Status:</label>
          <select
            value={filters.suspensionStatus}
            onChange={(e) => handleFilterChange('suspensionStatus', e.target.value)}
            className="form-select"
          >
            <option value="">All Markets</option>
            <option value="active">Released</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>
    </div>
  );
};
