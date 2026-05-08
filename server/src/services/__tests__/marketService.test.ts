/**
 * Service-level tests. Mocks the mysql2 pool so we can assert on the SQL
 * string + parameters the service generates, and verify the row-hydration
 * logic (DECIMAL strings → numbers, 0/1 → boolean).
 */
const mockExecute = jest.fn();

jest.mock('../../config/database', () => ({
  getPool: () => ({ execute: mockExecute })
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MarketService } = require('../marketService');

const rawRowFromDb = {
  id: 1,
  player_id: 1,
  stat_type_id: 102,
  // mysql2 hands DECIMAL columns back as strings — these are the literal
  // values it would produce, which the service must coerce to numbers.
  line: '8.50',
  market_suspended: 0,
  manual_suspension: null,
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
  player_name: 'Russell Westbrook',
  team_nickname: 'Lakers',
  team_abbr: 'LAL',
  position: 'PG',
  stat_type_name: 'assists',
  low_line: '6.00',
  high_line: '9.50',
  // The SQL CASE returns 0 or 1; service must coerce to a boolean.
  is_suspended: 0
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MarketService.getFilteredMarkets', () => {
  it('hydrates DECIMAL strings to numbers and 0/1 to boolean', async () => {
    mockExecute.mockResolvedValue([[rawRowFromDb], []]);
    const service = new MarketService();

    const result = await service.getFilteredMarkets({});
    expect(result).toHaveLength(1);
    const m = result[0];
    expect(typeof m.line).toBe('number');
    expect(typeof m.low_line).toBe('number');
    expect(typeof m.high_line).toBe('number');
    expect(m.line).toBe(8.5);
    expect(m.low_line).toBe(6);
    expect(m.high_line).toBe(9.5);
    expect(typeof m.is_suspended).toBe('boolean');
    expect(m.is_suspended).toBe(false);
  });

  it('produces the unwrapped query when suspensionStatus is not set', async () => {
    mockExecute.mockResolvedValue([[], []]);
    const service = new MarketService();
    await service.getFilteredMarkets({ position: 'PG' });

    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain('FROM markets m');
    expect(sql).toContain('p.position = ?');
    expect(sql).not.toContain('SELECT * FROM (');
    expect(sql).toMatch(/ORDER BY p\.name, st\.name$/);
    expect(params).toEqual(['PG']);
  });

  it('wraps in an outer SELECT to filter the computed is_suspended column', async () => {
    mockExecute.mockResolvedValue([[], []]);
    const service = new MarketService();
    await service.getFilteredMarkets({ suspensionStatus: 'suspended' });

    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain('SELECT * FROM (');
    expect(sql).toContain(') wrapped WHERE is_suspended = ?');
    expect(sql).toMatch(/ORDER BY player_name, stat_type_name$/);
    expect(params).toEqual([1]);
  });

  it('translates suspensionStatus=active to is_suspended = 0', async () => {
    mockExecute.mockResolvedValue([[], []]);
    const service = new MarketService();
    await service.getFilteredMarkets({ suspensionStatus: 'active' });

    const [, params] = mockExecute.mock.calls[0];
    expect(params).toEqual([0]);
  });

  it('search expands to LIKE on name, nickname, and abbr', async () => {
    mockExecute.mockResolvedValue([[], []]);
    const service = new MarketService();
    await service.getFilteredMarkets({ search: 'LAL' });

    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain('p.name LIKE ?');
    expect(sql).toContain('p.team_nickname LIKE ?');
    expect(sql).toContain('p.team_abbr LIKE ?');
    expect(params).toEqual(['%LAL%', '%LAL%', '%LAL%']);
  });
});

describe('MarketService SQL CASE encodes business rules in correct precedence', () => {
  // We can't run actual MySQL here, but we can assert the CASE expression
  // exists with the rules in the documented precedence order. If anyone
  // reorders the WHENs, this test fails — which would be a real bug
  // because manual override has to come first.
  it('manual_suspension comes first, then market_suspended, then alternate checks', async () => {
    mockExecute.mockResolvedValue([[], []]);
    const service = new MarketService();
    await service.getFilteredMarkets({});

    const [sql] = mockExecute.mock.calls[0];
    const manualIdx = sql.indexOf('m.manual_suspension IS NOT NULL');
    const flagIdx = sql.indexOf('m.market_suspended = 1');
    const noOptIdx = sql.indexOf('a_optimal.max_odds IS NULL');
    const oddsIdx = sql.indexOf('a_optimal.max_odds > 0.4');

    expect(manualIdx).toBeGreaterThanOrEqual(0);
    expect(flagIdx).toBeGreaterThan(manualIdx);
    expect(noOptIdx).toBeGreaterThan(flagIdx);
    expect(oddsIdx).toBeGreaterThan(noOptIdx);
  });

  it('uses strict > 0.4 for the rule-3 boundary (the bug fix)', async () => {
    mockExecute.mockResolvedValue([[], []]);
    const service = new MarketService();
    await service.getFilteredMarkets({});

    const [sql] = mockExecute.mock.calls[0];
    expect(sql).toContain('a_optimal.max_odds > 0.4');
    // The previous (buggy) code would have used >= here. Make sure we did
    // not silently regress.
    expect(sql).not.toContain('a_optimal.max_odds >= 0.4');
  });
});

describe('MarketService.updateManualSuspension', () => {
  it.each([
    [true, 1],
    [false, 0],
    [null, null]
  ] as const)('translates suspended=%p to manual_suspension=%p', async (input, expectedDbValue) => {
    mockExecute.mockResolvedValue([{ affectedRows: 1 }, []]);
    const service = new MarketService();

    await service.updateManualSuspension(42, input);

    const [, params] = mockExecute.mock.calls[0];
    expect(params).toEqual([expectedDbValue, 42]);
  });

  it('returns false when no rows match the id', async () => {
    mockExecute.mockResolvedValue([{ affectedRows: 0 }, []]);
    const service = new MarketService();

    const ok = await service.updateManualSuspension(999_999, true);
    expect(ok).toBe(false);
  });
});

describe('MarketService.getMarketById', () => {
  it('returns null when the market is missing', async () => {
    mockExecute.mockResolvedValue([[], []]);
    const service = new MarketService();
    const result = await service.getMarketById(999_999);
    expect(result).toBeNull();
  });

  it('hydrates the row when found', async () => {
    mockExecute.mockResolvedValue([[{ ...rawRowFromDb, is_suspended: 1 }], []]);
    const service = new MarketService();

    const result = await service.getMarketById(1);
    expect(result).not.toBeNull();
    expect(result.is_suspended).toBe(true);
    expect(result.line).toBe(8.5);
  });
});
