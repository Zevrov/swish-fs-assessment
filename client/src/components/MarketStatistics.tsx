import React, { useMemo } from 'react';
import { Market } from '../types';

interface Props {
  markets: Market[];
  loading: boolean;
}

interface Stats {
  total: number;
  suspended: number;
  active: number;
  manualOverrides: number;
}

const computeStats = (markets: Market[]): Stats =>
  markets.reduce<Stats>(
    (acc, m) => {
      acc.total += 1;
      if (m.is_suspended) acc.suspended += 1;
      else acc.active += 1;
      if (m.manual_suspension !== null) acc.manualOverrides += 1;
      return acc;
    },
    { total: 0, suspended: 0, active: 0, manualOverrides: 0 }
  );

export const MarketStatistics: React.FC<Props> = ({ markets, loading }) => {
  const stats = useMemo(() => computeStats(markets), [markets]);
  // Only show the em-dash placeholder on the very first load — during
  // subsequent refetches keep the previous numbers visible so the cards
  // don't flicker (and so they don't drive layout shifts elsewhere).
  const showPlaceholder = loading && markets.length === 0;

  return (
    <div className="stats-container" aria-busy={loading} aria-live="polite">
      <StatCard label="Total Markets" value={stats.total} placeholder={showPlaceholder} />
      <StatCard label="Suspended" value={stats.suspended} placeholder={showPlaceholder} variant="suspended" />
      <StatCard label="Released" value={stats.active} placeholder={showPlaceholder} variant="released" />
      <StatCard label="Manual Overrides" value={stats.manualOverrides} placeholder={showPlaceholder} variant="override" />
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: number;
  placeholder: boolean;
  variant?: 'suspended' | 'released' | 'override';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, placeholder, variant }) => (
  <div className={`stat-card${variant ? ` stat-card-${variant}` : ''}`}>
    <div className="stat-label">{label}</div>
    <div className="stat-value">{placeholder ? '—' : value}</div>
  </div>
);
