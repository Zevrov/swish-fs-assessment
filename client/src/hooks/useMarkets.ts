import { useEffect, useRef, useState } from 'react';
import { Market, Filters } from '../types';
import { api } from '../services/api';

export const useMarkets = () => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Markets with an in-flight suspension toggle. Used to disable the button
  // and reject overlapping clicks for the same market.
  const [pendingToggles, setPendingToggles] = useState<ReadonlySet<number>>(new Set());
  const pendingTogglesRef = useRef<Set<number>>(new Set());

  // Used to discard stale fetch responses if the user changes filters quickly.
  const fetchSeqRef = useRef(0);

  const fetchMarkets = async (filters?: Partial<Filters>) => {
    const seq = ++fetchSeqRef.current;
    try {
      setLoading(true);
      setError(null);

      const cleanFilters = filters
        ? Object.fromEntries(Object.entries(filters).filter(([_, value]) => value && value !== ''))
        : {};

      const result = await api.getMarkets(cleanFilters);
      if (seq !== fetchSeqRef.current) return;
      setMarkets(result.data);
    } catch (err) {
      if (seq !== fetchSeqRef.current) return;
      console.error('Error fetching markets:', err);
      setError('Failed to fetch markets');
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  };

  const setPending = (marketId: number, pending: boolean) => {
    if (pending) pendingTogglesRef.current.add(marketId);
    else pendingTogglesRef.current.delete(marketId);
    setPendingToggles(new Set(pendingTogglesRef.current));
  };

  const toggleSuspension = async (marketId: number) => {
    // Reject overlapping toggles for the same market — this is the source of
    // the rapid-click inconsistency where the second optimistic update reads
    // the first one's intermediate state.
    if (pendingTogglesRef.current.has(marketId)) return;

    const market = markets.find((m) => m.id === marketId);
    if (!market) return;

    let newManualSuspension: number | null;
    let newSuspendedState: boolean;

    if (market.manual_suspension !== null) {
      // Remove the manual override. We don't know the true computed status
      // without re-asking the server — fall back to the raw flag as an
      // approximation; the next fetch will reconcile.
      newManualSuspension = null;
      newSuspendedState = market.market_suspended === 1;
    } else {
      newManualSuspension = market.is_suspended ? 0 : 1;
      newSuspendedState = !market.is_suspended;
    }

    setPending(marketId, true);
    setMarkets((prev) =>
      prev.map((m) =>
        m.id === marketId
          ? { ...m, manual_suspension: newManualSuspension, is_suspended: newSuspendedState }
          : m
      )
    );

    try {
      const suspendedPayload = newManualSuspension === null ? null : Boolean(newManualSuspension);
      await api.updateManualSuspension(marketId, suspendedPayload);
    } catch (err) {
      console.error('Error updating manual override:', err);
      setMarkets((prev) =>
        prev.map((m) =>
          m.id === marketId
            ? { ...m, manual_suspension: market.manual_suspension, is_suspended: market.is_suspended }
            : m
        )
      );
    } finally {
      setPending(marketId, false);
    }
  };

  useEffect(() => {
    fetchMarkets();
  }, []);

  return {
    markets,
    loading,
    error,
    pendingToggles,
    fetchMarkets,
    toggleSuspension
  };
};
