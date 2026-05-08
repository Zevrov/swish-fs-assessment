import React from 'react';
import { Market } from '../types';

interface Props {
  markets: Market[];
  onToggleSuspension: (marketId: number) => void;
  loading: boolean;
  pendingToggles?: ReadonlySet<number>;
}

export const MarketTable: React.FC<Props> = ({ markets, onToggleSuspension, loading, pendingToggles }) => {
  // Only show the full loading screen on the first load — keeping previous
  // rows visible during a refetch prevents the page from collapsing and
  // jumping the scroll position back to the top.
  if (loading && markets.length === 0) {
    return <div className="loading-container">Loading markets...</div>;
  }

  if (!loading && markets.length === 0) {
    return <div className="empty-state">No markets found.</div>;
  }

  const getSuspensionDisplay = (market: Market) => {
    return market.is_suspended ? 'Suspended' : 'Released';
  };

  const getToggleButtonText = (market: Market) => {
    if (market.manual_suspension !== null) {
      return 'Remove Override';
    }
    return market.is_suspended ? 'Release' : 'Suspend';
  };

  return (
    <div className="table-container">
      <table className="table">
        <thead className="table-header">
          <tr>
            <th>Player</th>
            <th>Team</th>
            <th>Position</th>
            <th>Stat Type</th>
            <th className="center">Line</th>
            <th className="center">Low Line</th>
            <th className="center">High Line</th>
            <th className="center">Status</th>
            <th className="center">Manual Override</th>
          </tr>
        </thead>
        <tbody>
          {markets.map((market) => (
            <tr key={market.id} className="table-row">
              <td className="table-cell player-name">{market.player_name}</td>
              <td className="table-cell">
                {market.team_abbr} - {market.team_nickname}
              </td>
              <td className="table-cell">
                <span className="badge badge-position">{market.position}</span>
              </td>
              <td className="table-cell stat-type">{market.stat_type_name}</td>
              <td className="table-cell center bold">{market.line}</td>
              <td className="table-cell center">{market.low_line}</td>
              <td className="table-cell center">{market.high_line}</td>
              <td className="table-cell center">
                <span className={`badge ${market.is_suspended ? 'badge-suspended' : 'badge-released'}`}>
                  {getSuspensionDisplay(market)}
                </span>
              </td>
              <td className="table-cell center">
                <button
                  onClick={() => onToggleSuspension(market.id)}
                  disabled={pendingToggles?.has(market.id)}
                  className={`btn btn-small ${
                    market.manual_suspension !== null
                      ? 'btn-warning'
                      : market.is_suspended
                        ? 'btn-success'
                        : 'btn-danger'
                  }`}
                >
                  {pendingToggles?.has(market.id) ? 'Updating…' : getToggleButtonText(market)}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
