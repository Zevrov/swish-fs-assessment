import React, { useCallback, useEffect, useState } from 'react';
import { MarketTable } from './components/MarketTable';
import { MarketFilters } from './components/MarketFilters';
import { MarketStatistics } from './components/MarketStatistics';
import { MarketTabs } from './components/MarketTabs';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/Toast';
import { useMarkets } from './hooks/useMarkets';
import { useFilterOptions } from './hooks/useFilterOptions';
import { useToasts } from './hooks/useToasts';
import { Filters } from './types';
import './App.css';

function App() {
  const [filters, setFilters] = useState<Filters>({
    position: '',
    statType: '',
    suspensionStatus: '',
    search: ''
  });

  const { toasts, pushToast, dismissToast } = useToasts();

  // Show toggle failures as a toast — the row reverts behind the scenes,
  // but without this the user has no clue the click didn't apply.
  const onTransientError = useCallback(
    (message: string) => pushToast(message, 'error'),
    [pushToast]
  );

  const { markets, loading, error, pendingToggles, fetchMarkets, toggleSuspension } = useMarkets({
    onTransientError
  });
  const { filterOptions, error: filterOptionsError, retry: retryFilterOptions } = useFilterOptions();

  useEffect(() => {
    void fetchMarkets(filters);
  }, [filters, fetchMarkets]);

  const handleFiltersChange = (newFilters: Filters) => {
    setFilters(newFilters);
  };

  const handleStatTypeChange = (statType: string) => {
    setFilters((prev) => ({ ...prev, statType }));
  };

  if (error) {
    return (
      <div className="error-container" role="alert">
        <h3>Error Loading Markets</h3>
        <p>{error}</p>
        <button onClick={() => fetchMarkets(filters)} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="app-container">
        <header className="app-header">
          <h1 className="app-title">Swish Analytics - Player Markets</h1>
          <p className="app-subtitle">NBA Player Prop Betting Lines & Market Status</p>
        </header>

        {filterOptionsError && (
          <div className="inline-error" role="alert">
            <span>Could not load filter options.</span>
            <button onClick={retryFilterOptions} className="btn btn-small btn-primary">
              Retry
            </button>
          </div>
        )}

        <MarketFilters filters={filters} filterOptions={filterOptions} onFiltersChange={handleFiltersChange} />

        <MarketStatistics markets={markets} loading={loading} />

        <div className="section-container">
          <h2 className="section-title">Markets ({markets.length})</h2>
          <p className="section-description">
            • <strong>Optimal Line:</strong> Primary betting line from props data
            <br />• <strong>Low/High Line:</strong> Range of available alternate lines
            <br />• <strong>Status:</strong> Auto = computed suspension, Manual = user override
          </p>
        </div>

        <MarketTabs
          statTypes={filterOptions.statTypes}
          activeStatType={filters.statType}
          onChange={handleStatTypeChange}
        />

        <MarketTable
          markets={markets}
          onToggleSuspension={toggleSuspension}
          loading={loading}
          pendingToggles={pendingToggles}
        />

        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    </ErrorBoundary>
  );
}

export default App;
