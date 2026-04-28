-- Migration: Add financial_stress column to players
ALTER TABLE players ADD COLUMN financial_stress BOOLEAN DEFAULT false;

-- Ensure all current players have it initialized
UPDATE players SET financial_stress = false WHERE financial_stress IS NULL;
