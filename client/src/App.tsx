import React, { useState, useEffect } from 'react';
import { MarketTable } from './components/MarketTable';
import { MarketFilters } from './components/MarketFilters';
import { MarketStatistics } from './components/MarketStatistics';
import { useMarkets } from './hooks/useMarkets';
import { Filters } from './types';
import './App.css';

function App() {
  const [filters, setFilters] = useState<Filters>({
    position: '',
    statType: '',
    suspensionStatus: '',
    search: ''
  });

  const { markets, loading, error, pendingToggles, fetchMarkets, toggleSuspension } = useMarkets();

  useEffect(() => {
    fetchMarkets(filters);
  }, [filters]);

  const handleFiltersChange = (newFilters: Filters) => {
    setFilters(newFilters);
  };

  if (error) {
    return (
      <div className="error-container">
        <h3>Error Loading Markets</h3>
        <p>{error}</p>
        <button onClick={() => fetchMarkets(filters)} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">Swish Analytics - Player Markets</h1>
        <p className="app-subtitle">NBA Player Prop Betting Lines & Market Status</p>
      </header>

      <MarketFilters filters={filters} onFiltersChange={handleFiltersChange} />

      <MarketStatistics markets={markets} loading={loading} />

      <div className="section-container">
        <h2 className="section-title">Markets ({markets.length})</h2>
        <p className="section-description">
          • <strong>Optimal Line:</strong> Primary betting line from props data
          <br />• <strong>Low/High Line:</strong> Range of available alternate lines
          <br />• <strong>Status:</strong> Auto = computed suspension, Manual = user override
        </p>
      </div>

      <MarketTable
        markets={markets}
        onToggleSuspension={toggleSuspension}
        loading={loading}
        pendingToggles={pendingToggles}
      />
    </div>
  );
}

export default App;
