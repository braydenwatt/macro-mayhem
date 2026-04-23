CREATE TYPE player_class AS ENUM ('Worker', 'Businessman', 'Banker', 'Politician');
CREATE TYPE economy_status AS ENUM ('Growth', 'Recession', 'Depression');

CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  year INTEGER DEFAULT 1,
  turn INTEGER DEFAULT 1,
  current_player_id UUID,
  gdp INTEGER DEFAULT 5,
  inflation INTEGER DEFAULT 5,
  unemployment INTEGER DEFAULT 5,
  status economy_status DEFAULT 'Recession'
);

CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id),
  user_id UUID,
  name TEXT,
  class player_class,
  position INTEGER DEFAULT 0,
  balance INTEGER DEFAULT 2000,
  virtues INTEGER DEFAULT 0,
  is_waiting_at_go BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Policy Table
CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id),
  name TEXT,
  impact_gdp INTEGER,
  impact_inflation INTEGER,
  impact_unemployment INTEGER,
  is_active BOOLEAN DEFAULT false
);

-- Enable Realtime (Must be at the end)
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
