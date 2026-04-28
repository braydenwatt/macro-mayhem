-- Add bonus_voting_weight to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS bonus_voting_weight INTEGER DEFAULT 0;

-- Update min_wage policy to actually set min_salary and increment worker salaries
UPDATE policy_cards SET min_salary_set = 20 WHERE id = 'min_wage';

