ALTER TABLE games
  ADD COLUMN IF NOT EXISTS worker_strike_active BOOLEAN DEFAULT false;

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS banker_go_pending BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_square_index INTEGER;

CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  square_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (game_id, square_index)
);

ALTER PUBLICATION supabase_realtime ADD TABLE businesses;