-- Add missing unemployment roll flag to players
ALTER TABLE players ADD COLUMN unemployment_roll_pending BOOLEAN DEFAULT false;

-- Ensure all current players have it initialized
UPDATE players SET unemployment_roll_pending = false WHERE unemployment_roll_pending IS NULL;
