export interface Player {
  id: number;
  name: string;
  team_id: number;
  team_nickname: string;
  team_abbr: string;
  position: string;
}

export interface StatType {
  id: number;
  name: string;
}

export interface Market {
  id?: number;
  player_id: number;
  stat_type_id: number;
  line: number;
  market_suspended: number;
  manual_suspension?: number | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface Alternate {
  id?: number;
  player_id: number;
  stat_type_id: number;
  line: number;
  under_odds: number;
  over_odds: number;
  push_odds: number;
}

export interface MarketWithDetails extends Market {
  player_name: string;
  team_nickname: string;
  team_abbr: string;
  position: string;
  stat_type_name: string;
  low_line: number;
  high_line: number;
  is_suspended: boolean;
}

// JSON file structure types
export interface PropsJsonItem {
  playerName: string;
  playerId: number;
  teamId: number;
  teamNickname: string;
  teamAbbr: string;
  statType: string;
  statTypeId: number;
  position: string;
  marketSuspended: number;
  line: number;
}

export interface AlternatesJsonItem {
  playerName: string;
  playerId: number;
  statType: string;
  statTypeId: number;
  line: number;
  underOdds: number;
  overOdds: number;
  pushOdds: number;
}
