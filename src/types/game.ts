export type PlayerClass = 'Worker' | 'Businessman' | 'Banker' | 'Politician';

export type SquareType = 
  | 'GO' 
  | 'POLICY_VOTE'
  | 'VACATION'
  | 'PAY_EXPENSES'
  | 'CHANCE';

export interface BoardSquare {
  id: number;
  type: SquareType;
  label: string;
}

export interface Player {
  id: string;
  game_id: string;
  name: string;
  class: PlayerClass;
  position: number;
  balance: number;
  virtues: number;
  popularity: number;
  base_voting_weight: number;
  is_waiting_at_go: boolean;
  has_acted_this_year: boolean;
}

export type EconomyStatus = 'Growth' | 'Recession' | 'Depression';

export interface GameState {
  id: string;
  year: number;
  turn: number;
  current_player_id: string | null;
  gdp: number;
  inflation: number;
  unemployment: number;
  status: EconomyStatus;
  last_roll: number;
  has_rolled: boolean;
  current_policy_id: string | null;
  voting_active: boolean;
  last_action_message: string | null;
  started: boolean;
}

export interface Bid {
  player_id: string;
  vote: 'YES' | 'NO';
  amount: number;
}

export interface PolicyCard {
  id: string;
  name: string;
  gdp_mod: number;
  inflation_mod: number;
  unemployment_mod: number;
  money_delta: number;
  money_target: 'all' | 'worker' | 'businessman' | 'banker' | 'none';
}

export interface ChanceCard {
  id: string;
  name: string;
  gdp_mod: number;
  inflation_mod: number;
  unemployment_mod: number;
  money_delta: number;
  money_target: 'all' | 'worker' | 'businessman' | 'banker' | 'none';
  popularity_mod: number;
}
