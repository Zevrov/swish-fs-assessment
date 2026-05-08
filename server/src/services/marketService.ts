import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getPool } from '../config/database';
import { MarketWithDetails } from '../types';

const pool = getPool();

// mysql2 hands DECIMAL columns back as strings to preserve precision. We
// coerce to JS numbers at the service boundary so the API contract
// (MarketWithDetails uses `number`) is actually true. Same for the 0/1
// `is_suspended` integer the SQL `CASE` returns.
interface RawMarketRow extends RowDataPacket {
  id: number;
  player_id: number;
  stat_type_id: number;
  line: string | number;
  market_suspended: number;
  manual_suspension: number | null;
  created_at: Date;
  updated_at: Date;
  player_name: string;
  team_nickname: string;
  team_abbr: string;
  position: string;
  stat_type_name: string;
  low_line: string | number;
  high_line: string | number;
  is_suspended: number;
}

const toNum = (v: string | number): number => (typeof v === 'number' ? v : Number(v));

const hydrateMarket = (row: RawMarketRow): MarketWithDetails => ({
  id: row.id,
  player_id: row.player_id,
  stat_type_id: row.stat_type_id,
  line: toNum(row.line),
  market_suspended: row.market_suspended,
  manual_suspension: row.manual_suspension,
  created_at: row.created_at,
  updated_at: row.updated_at,
  player_name: row.player_name,
  team_nickname: row.team_nickname,
  team_abbr: row.team_abbr,
  position: row.position,
  stat_type_name: row.stat_type_name,
  low_line: toNum(row.low_line),
  high_line: toNum(row.high_line),
  is_suspended: Boolean(row.is_suspended)
});

export interface MarketFilters {
  position?: string;
  statType?: string;
  suspensionStatus?: string;
  search?: string;
}

export interface FilterOptions {
  positions: string[];
  statTypes: string[];
  suspensionStatuses: string[];
}

// Single query that returns every market joined with player/stat info,
// the low/high alternate-line range, and a computed is_suspended flag.
//
// Suspension precedence (mirrors the documented business rules):
//   1. Manual override wins if set.
//   2. market_suspended = 1 → suspended.
//   3. No alternate row at the optimal line → suspended.
//   4. All three odds at the optimal line are ≤ 0.4 → suspended.
//   5. Otherwise active.
//
// The two LEFT JOINs are pre-aggregated subqueries to keep the row count
// equal to `markets`, even if duplicate alternate rows exist.
const ENRICHED_MARKETS_BASE = `
  SELECT
    m.id,
    m.player_id,
    m.stat_type_id,
    m.line,
    m.market_suspended,
    m.manual_suspension,
    m.created_at,
    m.updated_at,
    p.name           AS player_name,
    p.team_nickname,
    p.team_abbr,
    p.position,
    st.name          AS stat_type_name,
    COALESCE(a_range.low_line, m.line)  AS low_line,
    COALESCE(a_range.high_line, m.line) AS high_line,
    CASE
      WHEN m.manual_suspension IS NOT NULL THEN m.manual_suspension
      WHEN m.market_suspended = 1          THEN 1
      WHEN a_optimal.max_odds IS NULL      THEN 1
      WHEN a_optimal.max_odds > 0.4        THEN 0
      ELSE 1
    END AS is_suspended
  FROM markets m
  JOIN players    p  ON p.id  = m.player_id
  JOIN stat_types st ON st.id = m.stat_type_id
  LEFT JOIN (
    SELECT player_id, stat_type_id,
           MIN(line) AS low_line,
           MAX(line) AS high_line
    FROM alternates
    GROUP BY player_id, stat_type_id
  ) a_range
    ON a_range.player_id    = m.player_id
   AND a_range.stat_type_id = m.stat_type_id
  LEFT JOIN (
    SELECT player_id, stat_type_id, line,
           GREATEST(MAX(under_odds), MAX(over_odds), MAX(push_odds)) AS max_odds
    FROM alternates
    GROUP BY player_id, stat_type_id, line
  ) a_optimal
    ON a_optimal.player_id    = m.player_id
   AND a_optimal.stat_type_id = m.stat_type_id
   AND a_optimal.line         = m.line
`;

export class MarketService {
  async getFilteredMarkets(filters: MarketFilters): Promise<MarketWithDetails[]> {
    const innerWhere: string[] = [];
    const innerParams: unknown[] = [];

    if (filters.position) {
      innerWhere.push('p.position = ?');
      innerParams.push(filters.position);
    }
    if (filters.statType) {
      innerWhere.push('st.name = ?');
      innerParams.push(filters.statType);
    }
    if (filters.search) {
      innerWhere.push('(p.name LIKE ? OR p.team_nickname LIKE ? OR p.team_abbr LIKE ?)');
      const term = `%${filters.search}%`;
      innerParams.push(term, term, term);
    }

    let inner = ENRICHED_MARKETS_BASE;
    if (innerWhere.length) {
      inner += ' WHERE ' + innerWhere.join(' AND ');
    }

    // suspensionStatus filters on a computed column, so it has to live in an
    // outer SELECT that wraps the base query.
    let sql: string;
    const params = [...innerParams];
    if (filters.suspensionStatus === 'suspended' || filters.suspensionStatus === 'active') {
      sql = `SELECT * FROM (${inner}) wrapped WHERE is_suspended = ? ORDER BY player_name, stat_type_name`;
      params.push(filters.suspensionStatus === 'suspended' ? 1 : 0);
    } else {
      sql = `${inner} ORDER BY p.name, st.name`;
    }

    const [rows] = await pool.execute<RawMarketRow[]>(sql, params);
    return rows.map(hydrateMarket);
  }

  async getFilterOptions(): Promise<FilterOptions> {
    const [positionRows] = await pool.execute<(RowDataPacket & { position: string })[]>(
      'SELECT DISTINCT position FROM players WHERE position IS NOT NULL ORDER BY position'
    );
    const [statTypeRows] = await pool.execute<(RowDataPacket & { name: string })[]>(
      'SELECT name FROM stat_types ORDER BY name'
    );

    return {
      positions: positionRows.map((r) => r.position),
      statTypes: statTypeRows.map((r) => r.name),
      suspensionStatuses: ['suspended', 'active']
    };
  }

  async updateManualSuspension(marketId: number, suspended: boolean | null): Promise<boolean> {
    const manualValue = suspended === null ? null : suspended ? 1 : 0;

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE markets
         SET manual_suspension = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      [manualValue, marketId]
    );
    return result.affectedRows > 0;
  }

  // Re-runs the enriched query for a single market. Used by the PUT
  // endpoint to return the freshly-computed row so the client doesn't
  // have to approximate the post-update suspension status.
  async getMarketById(marketId: number): Promise<MarketWithDetails | null> {
    const sql = `${ENRICHED_MARKETS_BASE} WHERE m.id = ?`;
    const [rows] = await pool.execute<RawMarketRow[]>(sql, [marketId]);
    const first = rows[0];
    if (!first) return null;
    return hydrateMarket(first);
  }
}
