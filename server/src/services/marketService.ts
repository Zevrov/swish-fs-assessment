import { getPool } from '../config/database';
import { MarketWithDetails } from '../types';

const pool = getPool();

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

    const [rows] = await pool.execute(sql, params);
    return (rows as any[]).map((row) => ({
      ...row,
      is_suspended: Boolean(row.is_suspended)
    })) as MarketWithDetails[];
  }

  async getFilterOptions(): Promise<FilterOptions> {
    const [positionRows] = await pool.execute(
      'SELECT DISTINCT position FROM players WHERE position IS NOT NULL ORDER BY position'
    );
    const [statTypeRows] = await pool.execute('SELECT name FROM stat_types ORDER BY name');

    return {
      positions: (positionRows as { position: string }[]).map((r) => r.position),
      statTypes: (statTypeRows as { name: string }[]).map((r) => r.name),
      suspensionStatuses: ['suspended', 'active']
    };
  }

  async updateManualSuspension(marketId: number, suspended: boolean | null): Promise<boolean> {
    const manualValue = suspended === null ? null : suspended ? 1 : 0;

    const [result] = await pool.execute(
      `UPDATE markets
         SET manual_suspension = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      [manualValue, marketId]
    );
    const { affectedRows } = result as { affectedRows: number };
    return affectedRows > 0;
  }

  // Re-runs the enriched query for a single market. Used by the PUT
  // endpoint to return the freshly-computed row so the client doesn't
  // have to approximate the post-update suspension status.
  async getMarketById(marketId: number): Promise<MarketWithDetails | null> {
    const sql = `${ENRICHED_MARKETS_BASE} WHERE m.id = ?`;
    const [rows] = await pool.execute(sql, [marketId]);
    const list = rows as any[];
    if (list.length === 0) return null;
    return { ...list[0], is_suspended: Boolean(list[0].is_suspended) } as MarketWithDetails;
  }
}
