-- 1. Action Logs for the central chat
CREATE TABLE action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Policy Trades for negotiation
CREATE TABLE policy_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  proposer_id UUID REFERENCES players(id) ON DELETE CASCADE,
  target_id UUID REFERENCES players(id) ON DELETE CASCADE,
  money_offered INTEGER DEFAULT 0,
  popularity_offered INTEGER DEFAULT 0,
  forced_vote TEXT CHECK (forced_vote IN ('YES', 'NO')),
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Update Players table
ALTER TABLE players 
  ADD COLUMN unemployed_this_turn BOOLEAN DEFAULT false,
  ADD COLUMN exec_order_used_this_year BOOLEAN DEFAULT false,
  ADD COLUMN popularity_choice_pending BOOLEAN DEFAULT false,
  ADD COLUMN vote_confirmed BOOLEAN DEFAULT false;

-- 4. Update Games table
ALTER TABLE games 
  ALTER COLUMN tax_rate SET DEFAULT 20,
  ADD COLUMN next_policy_id TEXT REFERENCES policy_cards(id);

-- Update existing games to 20% tax
UPDATE games SET tax_rate = 20 WHERE tax_rate = 10;

-- 5. Add new Personal Chance Cards
INSERT INTO chance_cards (id, name, gdp_mod, inflation_mod, unemployment_mod, money_delta, money_target, popularity_mod) VALUES
('car_breakdown', 'Car Breakdown', 0, 0, 0, -20, 'none', 0),
('robbery', 'Robbery', 0, 0, 0, 0, 'none', 0), -- Logic for 50% loss will be in code
('watergate', 'Watergate Scandal', 0, 0, 0, 0, 'none', -10); -- Logic for "all" loss will be in code

-- Enable Realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE action_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE policy_trades;
