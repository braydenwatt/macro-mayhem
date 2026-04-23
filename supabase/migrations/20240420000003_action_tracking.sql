-- Add action tracking to players
ALTER TABLE players ADD COLUMN has_acted_this_year BOOLEAN DEFAULT false;

-- Add broadcast message to games
ALTER TABLE games ADD COLUMN last_action_message TEXT DEFAULT NULL;
