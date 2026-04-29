-- Add weight column to policy_cards and chance_cards
ALTER TABLE policy_cards ADD COLUMN weight INTEGER DEFAULT 5;
ALTER TABLE chance_cards ADD COLUMN weight INTEGER DEFAULT 5;

-- Update Weights for Policy Cards
UPDATE policy_cards SET weight = 3 WHERE id = 'min_wage';
UPDATE policy_cards SET weight = 3 WHERE id = 'welfare';
UPDATE policy_cards SET weight = 4 WHERE id = 'tax_cut';

-- Update Weights for Chance Cards
UPDATE chance_cards SET weight = 1 WHERE id = 'watergate';
UPDATE chance_cards SET weight = 3 WHERE id = 'robbery';
UPDATE chance_cards SET weight = 3 WHERE id = 'tech_bust';
UPDATE chance_cards SET weight = 3 WHERE id = 'supply_chain';
UPDATE chance_cards SET weight = 3 WHERE id = 'labor_strike';
UPDATE chance_cards SET weight = 3 WHERE id = 'corp_scandal';
UPDATE chance_cards SET weight = 4 WHERE id = 'gov_efficiency';
UPDATE chance_cards SET weight = 4 WHERE id = 'unexpected_tax';
