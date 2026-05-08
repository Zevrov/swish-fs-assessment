/**
 * Route-level tests. The MarketService is mocked so these tests exercise
 * exclusively the route's input validation, status-code mapping, and the
 * shape of the API envelope. The real SQL is covered by the service-level
 * tests next door.
 */
import request from 'supertest';

// Stub the service before importing the app — `routes/markets.ts` constructs
// `new MarketService()` at module load time, so the mock has to be in place
// first.
const mockUpdate = jest.fn();
const mockGetById = jest.fn();
const mockGetFiltered = jest.fn();
const mockGetFilterOptions = jest.fn();

jest.mock('../../services/marketService', () => ({
  MarketService: jest.fn().mockImplementation(() => ({
    updateManualSuspension: mockUpdate,
    getMarketById: mockGetById,
    getFilteredMarkets: mockGetFiltered,
    getFilterOptions: mockGetFilterOptions
  }))
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = require('../../index').default;

const enrichedMarketFixture = {
  id: 1,
  player_id: 1,
  stat_type_id: 102,
  line: 8.5,
  market_suspended: 0,
  manual_suspension: 1,
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
  player_name: 'Russell Westbrook',
  team_nickname: 'Lakers',
  team_abbr: 'LAL',
  position: 'PG',
  stat_type_name: 'assists',
  low_line: 6,
  high_line: 9.5,
  is_suspended: true
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PUT /api/markets/:id/suspension', () => {
  it('200 + enriched market when suspended=true', async () => {
    mockUpdate.mockResolvedValue(true);
    mockGetById.mockResolvedValue(enrichedMarketFixture);

    const res = await request(app).put('/api/markets/1/suspension').send({ suspended: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(1);
    expect(res.body.data.is_suspended).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(1, true);
  });

  it('200 when clearing the override (suspended=null)', async () => {
    mockUpdate.mockResolvedValue(true);
    mockGetById.mockResolvedValue({ ...enrichedMarketFixture, manual_suspension: null });

    const res = await request(app).put('/api/markets/1/suspension').send({ suspended: null });

    expect(res.status).toBe(200);
    expect(res.body.data.manual_suspension).toBeNull();
    expect(mockUpdate).toHaveBeenCalledWith(1, null);
  });

  it('400 on string-valued "suspended"', async () => {
    const res = await request(app).put('/api/markets/1/suspension').send({ suspended: 'yes' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/suspended/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('400 on missing body', async () => {
    const res = await request(app).put('/api/markets/1/suspension').send({});

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('400 on non-numeric id', async () => {
    const res = await request(app).put('/api/markets/abc/suspension').send({ suspended: true });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid market id/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('400 on id with trailing garbage (the parseInt trap)', async () => {
    // parseInt('5abc') === 5, so the lazy version of this guard would have
    // accepted this path. The strict regex must reject it.
    const res = await request(app).put('/api/markets/5abc/suspension').send({ suspended: true });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('400 on id=0', async () => {
    const res = await request(app).put('/api/markets/0/suspension').send({ suspended: true });
    expect(res.status).toBe(400);
  });

  it('400 on negative id', async () => {
    const res = await request(app).put('/api/markets/-5/suspension').send({ suspended: true });
    expect(res.status).toBe(400);
  });

  it('400 on id beyond MySQL INT range', async () => {
    const res = await request(app).put('/api/markets/2147483648/suspension').send({ suspended: true });
    expect(res.status).toBe(400);
  });

  it('404 when the service reports no rows affected', async () => {
    mockUpdate.mockResolvedValue(false);

    const res = await request(app).put('/api/markets/999999/suspension').send({ suspended: true });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(mockGetById).not.toHaveBeenCalled();
  });

  it('500 with envelope when the service throws', async () => {
    mockUpdate.mockRejectedValue(new Error('boom'));

    const res = await request(app).put('/api/markets/1/suspension').send({ suspended: true });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('still reports success if UPDATE applied but follow-up read fails', async () => {
    // Real edge case: the write went through, only the second SELECT broke.
    // We must not lie to the client by sending 500 — they would roll back
    // an optimistic update that actually persisted.
    mockUpdate.mockResolvedValue(true);
    mockGetById.mockRejectedValue(new Error('connection lost'));

    const res = await request(app).put('/api/markets/1/suspension').send({ suspended: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.warning).toMatch(/refetch/i);
  });
});

describe('GET /api/markets', () => {
  it('passes filters through to the service and returns count', async () => {
    mockGetFiltered.mockResolvedValue([enrichedMarketFixture]);

    const res = await request(app).get('/api/markets').query({
      position: 'PG',
      statType: 'assists',
      suspensionStatus: 'suspended',
      search: 'Westbrook'
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
    expect(mockGetFiltered).toHaveBeenCalledWith({
      position: 'PG',
      statType: 'assists',
      suspensionStatus: 'suspended',
      search: 'Westbrook'
    });
  });

  it('500 envelope when the service throws', async () => {
    mockGetFiltered.mockRejectedValue(new Error('db down'));

    const res = await request(app).get('/api/markets');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('app-level error handling', () => {
  it('JSON 404 for unknown routes (instead of HTML)', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/route not found/i);
  });

  it('JSON 400 for malformed JSON bodies (caught by global handler)', async () => {
    const res = await request(app)
      .put('/api/markets/1/suspension')
      .set('Content-Type', 'application/json')
      .send('{ not valid json');

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.error).toMatch(/malformed/i);
  });
});
