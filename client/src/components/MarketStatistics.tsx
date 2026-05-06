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

  return (
    <div className="stats-container" aria-busy={loading} aria-live="polite">
      <StatCard label="Total Markets" value={stats.total} loading={loading} />
      <StatCard label="Suspended" value={stats.suspended} loading={loading} variant="suspended" />
      <StatCard label="Released" value={stats.active} loading={loading} variant="released" />
      <StatCard label="Manual Overrides" value={stats.manualOverrides} loading={loading} variant="override" />
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: number;
  loading: boolean;
  variant?: 'suspended' | 'released' | 'override';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, loading, variant }) => (
  <div className={`stat-card${variant ? ` stat-card-${variant}` : ''}`}>
    <div className="stat-label">{label}</div>
    <div className="stat-value">{loading ? '—' : value}</div>
  </div>
);
