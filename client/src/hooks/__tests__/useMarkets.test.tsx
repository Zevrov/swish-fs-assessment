/**
 * Hook tests for useMarkets. The api module is mocked so we can drive the
 * promise lifecycle precisely (delay, fail, resolve out of order).
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useMarkets } from '../useMarkets';
import { Market } from '../../types';

jest.mock('../../services/api', () => {
  const original = jest.requireActual('../../services/api');
  return {
    ...original,
    api: {
      getMarkets: jest.fn(),
      updateManualSuspension: jest.fn(),
      getFilterOptions: jest.fn()
    }
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { api, ApiError } = require('../../services/api');

const market = (overrides: Partial<Market> = {}): Market => ({
  id: 1,
  player_id: 1,
  stat_type_id: 102,
  line: 8.5,
  market_suspended: 0,
  manual_suspension: null,
  player_name: 'Russell Westbrook',
  team_nickname: 'Lakers',
  team_abbr: 'LAL',
  position: 'PG',
  stat_type_name: 'assists',
  low_line: 6,
  high_line: 9.5,
  is_suspended: false,
  ...overrides
});

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  // resetAllMocks (vs clearAllMocks) also drops queued mockResolvedValueOnce
  // implementations, so a tail of unconsumed once-mocks from one test can't
  // leak into the next.
  jest.resetAllMocks();
});

describe('useMarkets', () => {
  it('loads markets on mount', async () => {
    api.getMarkets.mockResolvedValue({ data: [market()], count: 1 });

    const { result } = renderHook(() => useMarkets());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.markets).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('drops a stale fetch response when filters changed during the request', async () => {
    // First fetch: slow, returns "old" data.
    let resolveFirst: ((v: unknown) => void) | undefined;
    api.getMarkets.mockImplementationOnce(
      () => new Promise((resolve) => { resolveFirst = resolve; })
    );
    // Second fetch: resolves immediately with "new" data.
    api.getMarkets.mockResolvedValueOnce({ data: [market({ id: 99, player_name: 'New' })], count: 1 });

    const { result } = renderHook(() => useMarkets());

    // Trigger the second fetch before the first resolves.
    await act(async () => {
      result.current.fetchMarkets({ position: 'C' });
      await flush();
    });

    // Now resolve the first fetch — its result is stale and must be ignored.
    await act(async () => {
      resolveFirst?.({ data: [market({ id: 1, player_name: 'OLD' })], count: 1 });
      await flush();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.markets[0]?.player_name).toBe('New');
  });

  it('rejects overlapping toggles for the same market (race fix)', async () => {
    api.getMarkets.mockResolvedValue({ data: [market()], count: 1 });
    let resolveUpdate: ((v: Market) => void) | undefined;
    api.updateManualSuspension.mockImplementationOnce(
      () => new Promise<Market>((resolve) => { resolveUpdate = resolve; })
    );
    api.updateManualSuspension.mockResolvedValueOnce(market({ manual_suspension: 1, is_suspended: true }));

    const { result } = renderHook(() => useMarkets());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Click 1 — fires the in-flight PUT.
    await act(async () => {
      result.current.toggleSuspension(1);
      await flush();
    });

    // Click 2 — must be dropped while the first is pending.
    await act(async () => {
      result.current.toggleSuspension(1);
      await flush();
    });
    expect(api.updateManualSuspension).toHaveBeenCalledTimes(1);

    // Resolve click 1; subsequent clicks should now be allowed.
    await act(async () => {
      resolveUpdate?.(market({ manual_suspension: 1, is_suspended: true }));
      await flush();
    });
    await waitFor(() => expect(result.current.pendingToggles.has(1)).toBe(false));
  });

  it('clears override and replaces row with server-computed truth (the U7 fix)', async () => {
    // Setup: a market currently has manual_suspension=0 (released by override),
    // but the underlying rule-3 truth is is_suspended=true.
    const overridden = market({ manual_suspension: 0, is_suspended: false });
    const truthFromServer = market({ manual_suspension: null, is_suspended: true });
    api.getMarkets.mockResolvedValue({ data: [overridden], count: 1 });
    api.updateManualSuspension.mockResolvedValue(truthFromServer);

    const { result } = renderHook(() => useMarkets());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleSuspension(1);
    });

    // Hook must replace the row with the server's truth — without this fix
    // the optimistic guess would have set is_suspended=false (wrong).
    expect(result.current.markets[0]?.is_suspended).toBe(true);
    expect(result.current.markets[0]?.manual_suspension).toBeNull();
    expect(api.updateManualSuspension).toHaveBeenCalledWith(1, null);
  });

  it('rolls back optimistic update and fires onTransientError on failure', async () => {
    api.getMarkets.mockResolvedValue({ data: [market()], count: 1 });
    api.updateManualSuspension.mockRejectedValue(new ApiError('boom', { status: 500 }));

    const onTransientError = jest.fn();
    const { result } = renderHook(() => useMarkets({ onTransientError }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleSuspension(1);
    });

    // Original state restored — `is_suspended: false`, `manual_suspension: null`.
    expect(result.current.markets[0]?.is_suspended).toBe(false);
    expect(result.current.markets[0]?.manual_suspension).toBeNull();
    expect(onTransientError).toHaveBeenCalledTimes(1);
    expect(onTransientError.mock.calls[0][0]).toMatch(/server error/i);
  });
});
