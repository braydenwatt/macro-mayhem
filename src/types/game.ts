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
  unemployed_this_turn: boolean;
  exec_order_used_this_year: boolean;
  event_roll_pending: 'VACATION' | 'PAY_EXPENSES' | null;
  unemployment_roll_pending: boolean;
  vote_confirmed: boolean;
  financial_stress: boolean;
  bonus_voting_weight: number;
  banker_go_pending: boolean;
  pending_square_index: number | null;
}

export type EconomyStatus = 'Growth' | 'Recession' | 'Depression';

export interface ExpenseCard {
  id: string;
  name: string;
  cost_multiplier: number;
  description: string;
  unpaid_effect: string;
  target_class: 'worker' | 'businessman' | 'banker' | 'politician' | 'all' | 'none';
}

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
  next_policy_id: string | null;
  voting_active: boolean;
  last_action_message: string | null;
  started: boolean;
  tax_rate: number;
  min_salary: number;
  policy_vote_start?: string | null;
  square_action_resolved: boolean;
  worker_strike_active: boolean;
}

export interface BusinessOwnership {
  id: string;
  game_id: string;
  player_id: string;
  square_index: number;
  created_at: string;
}

export type EconomicIndicator = 'gdp' | 'inflation' | 'unemployment';

export interface ActionLog {
  id: string;
  game_id: string;
  player_id: string;
  action_type: string;
  message: string;
  created_at: string;
}

export interface PolicyTrade {
  id: string;
  game_id: string;
  proposer_id: string;
  target_id: string;
  money_offered: number;
  popularity_offered: number;
  forced_vote: 'YES' | 'NO';
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  created_at: string;
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
  tax_mod?: number;
  min_salary_set?: number | null;
  weight?: number;
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
  weight?: number;
}
