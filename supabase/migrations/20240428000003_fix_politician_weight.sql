-- Fix Politician Base Voting Weight
UPDATE players SET base_voting_weight = 1 WHERE class = 'Politician';
