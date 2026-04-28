-- Add taxation and min_salary to games
ALTER TABLE games ADD COLUMN tax_rate INTEGER DEFAULT 10;
ALTER TABLE games ADD COLUMN min_salary INTEGER DEFAULT 0;

-- Add tax and min_salary modifiers to policy_cards
ALTER TABLE policy_cards ADD COLUMN tax_mod INTEGER DEFAULT 0;
ALTER TABLE policy_cards ADD COLUMN min_salary_set INTEGER DEFAULT NULL;

-- Update existing policies with new effects
UPDATE policy_cards SET money_delta = 20 WHERE id = 'stimulus';
UPDATE policy_cards SET money_delta = -30 WHERE id = 'austerity';
UPDATE policy_cards SET money_delta = 30 WHERE id = 'rate_hike';
UPDATE policy_cards SET money_delta = 40 WHERE id = 'min_wage';
UPDATE policy_cards SET money_delta = -20 WHERE id = 'infrastructure';

-- Corporate Tax Cut: GDP +1, Inflation +1, Income Tax Rate -10%
UPDATE policy_cards SET 
  gdp_mod = 1, 
  inflation_mod = 1, 
  money_delta = 0, 
  money_target = 'none', 
  tax_mod = -10 
WHERE id = 'tax_cut';

-- Welfare Expansion: Inflation +1, Unemployment -1, Min $20 salary + Tax Increase by 20%
UPDATE policy_cards SET 
  inflation_mod = 1, 
  unemployment_mod = -1, 
  money_delta = 0, 
  money_target = 'none', 
  tax_mod = 20, 
  min_salary_set = 20 
WHERE id = 'welfare';
