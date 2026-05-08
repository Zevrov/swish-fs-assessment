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

    // Decide the new manual_suspension value. Setting an override is the
    // inverse of the current effective state; if there's already an override
    // active, the click clears it.
    let newManualSuspension: number | null;
    if (market.manual_suspension !== null) {
      newManualSuspension = null;
    } else {
      newManualSuspension = market.is_suspended ? 0 : 1;
    }

    // Optimistic update: when *setting* an override we know the answer
    // exactly (manual values win). When *clearing* an override we keep the
    // current row visible and let the server's response replace it — this
    // avoids the rule-2/rule-3 approximation that used to lie until the
    // next list refresh.
    const optimistic =
      newManualSuspension === null
        ? market
        : { ...market, manual_suspension: newManualSuspension, is_suspended: Boolean(newManualSuspension) };

    setPending(marketId, true);
    if (optimistic !== market) {
      setMarkets((prev) => prev.map((m) => (m.id === marketId ? optimistic : m)));
    }

    try {
      const suspendedPayload = newManualSuspension === null ? null : Boolean(newManualSuspension);
      const updated = await api.updateManualSuspension(marketId, suspendedPayload);
      // Replace the row with the server-computed truth — covers the clear-
      // override case (where rules 2/3 may flip is_suspended back to true)
      // and reconciles any drift from the optimistic guess.
      setMarkets((prev) => prev.map((m) => (m.id === marketId ? { ...m, ...updated } : m)));
    } catch (err) {
      console.error('Error updating manual override:', err);
      setMarkets((prev) => prev.map((m) => (m.id === marketId ? market : m)));
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
