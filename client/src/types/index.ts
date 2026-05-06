export interface Market {
  id: number;
  player_id: number;
  stat_type_id: number;
  line: number;
  market_suspended: number;
  manual_suspension: number | null;
  player_name: string;
  team_nickname: string;
  team_abbr: string;
  position: string;
  stat_type_name: string;
  low_line: number;
  high_line: number;
  is_suspended: boolean;
}

export interface Filters {
  position: string;
  statType: string;
  suspensionStatus: string;
  search: string;
}

export interface FilterOptions {
  positions: string[];
  statTypes: string[];
  suspensionStatuses: string[];
}
