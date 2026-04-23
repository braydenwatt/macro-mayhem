-- Update games table for 1-5 level system
ALTER TABLE games 
  ALTER COLUMN gdp SET DEFAULT 3,
  ALTER COLUMN inflation SET DEFAULT 3,
  ALTER COLUMN unemployment SET DEFAULT 3;

-- Ensure existing games are reset to stable if needed (optional, but good for dev)
UPDATE games SET gdp = 3, inflation = 3, unemployment = 3;

-- Update players table for Popularity and Voting
ALTER TABLE players ADD COLUMN popularity INTEGER DEFAULT 5; -- Range 1-10
ALTER TABLE players ADD COLUMN base_voting_weight INTEGER DEFAULT 1;

-- Set default voting weights based on class
UPDATE players SET base_voting_weight = 1 WHERE class = 'Worker';
UPDATE players SET base_voting_weight = 2 WHERE class = 'Businessman';
UPDATE players SET base_voting_weight = 1 WHERE class = 'Banker';
UPDATE players SET base_voting_weight = 2 WHERE class = 'Politician';

-- Policy Deck Table
CREATE TABLE policy_cards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gdp_mod INTEGER DEFAULT 0,
  inflation_mod INTEGER DEFAULT 0,
  unemployment_mod INTEGER DEFAULT 0,
  money_delta INTEGER DEFAULT 0,
  money_target TEXT DEFAULT 'all' -- 'all', 'worker', 'businessman', 'banker', 'none'
);

-- Chance Deck Table
CREATE TABLE chance_cards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gdp_mod INTEGER DEFAULT 0,
  inflation_mod INTEGER DEFAULT 0,
  unemployment_mod INTEGER DEFAULT 0,
  money_delta INTEGER DEFAULT 0,
  money_target TEXT DEFAULT 'all',
  popularity_mod INTEGER DEFAULT 0
);

-- Seed Policy Deck
INSERT INTO policy_cards (id, name, gdp_mod, inflation_mod, unemployment_mod, money_delta, money_target) VALUES
('stimulus', 'Stimulus Package', 1, 1, 0, 2, 'all'),
('austerity', 'Austerity Measures', -1, 0, 1, -3, 'all'),
('rate_hike', 'Interest Rate Hike', -1, -2, 0, 3, 'banker'),
('min_wage', 'Minimum Wage Increase', 0, 1, 1, 4, 'worker'),
('infrastructure', 'Infrastructure Project', 1, 0, -1, -2, 'all'),
('tax_cut', 'Corporate Tax Cut', 1, 1, 0, 5, 'businessman'),
('green_energy', 'Green Energy Grant', 1, -1, 0, 0, 'none'),
('welfare', 'Welfare Expansion', 0, 1, -1, 3, 'worker');

-- Seed Chance Deck
INSERT INTO chance_cards (id, name, gdp_mod, inflation_mod, unemployment_mod, money_delta, money_target, popularity_mod) VALUES
('ai_boom', 'AI Boom', 1, 0, 0, 2, 'all', 0),
('tech_bust', 'Tech Bust', -2, 0, 1, 0, 'none', 0),
('supply_chain', 'Supply Chain Crisis', 0, 2, 0, -3, 'all', 0),
('energy_discovery', 'Energy Discovery', 1, -1, 0, 0, 'none', 0),
('labor_strike', 'Labor Strike', 0, 0, -1, 5, 'worker', 0),
('corp_scandal', 'Corporate Scandal', -1, 0, 0, -5, 'businessman', 0),
('gov_efficiency', 'Government Efficiency', 0, 0, 0, 0, 'none', 2),
('unexpected_tax', 'Unexpected Tax', 0, 0, 0, -4, 'all', 0);
