-- Migration: Add event_roll_pending and remove popularity_choice_pending
ALTER TABLE players ADD COLUMN event_roll_pending TEXT CHECK (event_roll_pending IN ('VACATION', 'PAY_EXPENSES'));
ALTER TABLE players DROP COLUMN popularity_choice_pending;
