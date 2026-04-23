-- Track current active policy for a game
ALTER TABLE games ADD COLUMN current_policy_id TEXT REFERENCES policy_cards(id);
ALTER TABLE games ADD COLUMN voting_active BOOLEAN DEFAULT false;

-- Table for secret bids
CREATE TABLE policy_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  policy_id TEXT REFERENCES policy_cards(id),
  vote TEXT CHECK (vote IN ('YES', 'NO')),
  amount INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(game_id, player_id, policy_id)
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE policy_bids;
