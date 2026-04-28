/**
 * Test Helpers - Available when running `npm run dev:test`
 * Provides utilities for easier game testing and debugging
 */

import { supabase } from '../services/supabase';

const TEST_MODE = import.meta.env.VITE_TEST_MODE === true || import.meta.env.VITE_TEST_MODE === 'true';

export const isTestMode = (): boolean => TEST_MODE;

export const log = (label: string, data: any) => {
  if (TEST_MODE) {
    console.log(`[TEST_MODE] ${label}:`, data);
  }
};

// Board layout reference
const BOARD_LAYOUT = [
  { type: 'GO', label: 'GO', subLabel: 'Collect Salary' }, // 0
  { type: 'POLICY_VOTE', label: 'Policy Vote', subLabel: 'Cast Your Ballot' },
  { type: 'VACATION', label: 'Vacation', subLabel: 'Relax & Recovery' },
  { type: 'PAY_EXPENSES', label: 'Pay Expenses', subLabel: 'Bills Due' },
  { type: 'CHANCE', label: 'Random Chance', subLabel: 'Market News' },
  { type: 'POLICY_VOTE', label: 'Policy Vote', subLabel: 'Cast Your Ballot' },
  { type: 'CHANCE', label: 'Random Chance', subLabel: 'Market News' }, // 6
  { type: 'PAY_EXPENSES', label: 'Pay Expenses', subLabel: 'Bills Due' },
  { type: 'CHANCE', label: 'Random Chance', subLabel: 'Market News' },
  { type: 'POLICY_VOTE', label: 'Policy Vote', subLabel: 'Cast Your Ballot' },
  { type: 'VACATION', label: 'Vacation', subLabel: 'Relax & Recovery' },
  { type: 'PAY_EXPENSES', label: 'Pay Expenses', subLabel: 'Bills Due' },
  { type: 'GO', label: 'SALARY', subLabel: 'Mid-Year Payout' }, // 12
  { type: 'POLICY_VOTE', label: 'Policy Vote', subLabel: 'Cast Your Ballot' },
  { type: 'VACATION', label: 'Vacation', subLabel: 'Relax & Recovery' },
  { type: 'PAY_EXPENSES', label: 'Pay Expenses', subLabel: 'Bills Due' },
  { type: 'CHANCE', label: 'Random Chance', subLabel: 'Market News' },
  { type: 'POLICY_VOTE', label: 'Policy Vote', subLabel: 'Cast Your Ballot' },
  { type: 'POLICY_VOTE', label: 'Policy Vote', subLabel: 'Cast Your Ballot' }, // 18
  { type: 'VACATION', label: 'Vacation', subLabel: 'Relax & Recovery' },
  { type: 'PAY_EXPENSES', label: 'Pay Expenses', subLabel: 'Bills Due' },
  { type: 'CHANCE', label: 'Random Chance', subLabel: 'Market News' },
  { type: 'POLICY_VOTE', label: 'Policy Vote', subLabel: 'Cast Your Ballot' },
  { type: 'VACATION', label: 'Vacation', subLabel: 'Relax & Recovery' }
];

/**
 * Game test utilities - add to window for console access
 * Usage: window.__GAME_TEST__
 */
if (TEST_MODE) {
  (window as any).__GAME_TEST__ = {
    testMode: true,
    log,
    
    /**
     * Move current player to any square (0-23)
     * Usage: await window.__GAME_TEST__.moveToSquare(5)
     */
    moveToSquare: async (squareIndex: number) => {
      if (squareIndex < 0 || squareIndex > 23) {
        console.error('❌ Invalid square index. Must be 0-23');
        return;
      }
      
      try {
        // Get current player from session storage or game state
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        
        if (!userId) {
          // Try to get from any active player
          const { data: players } = await supabase.from('players').select('*').limit(1).single();
          if (!players) {
            console.error('❌ No active player found');
            return;
          }
          
          const square = BOARD_LAYOUT[squareIndex];
          console.log(`🎲 MOVING TO SQUARE ${squareIndex}:`, {
            label: square.label,
            type: square.type,
            subLabel: square.subLabel
          });
          
          await supabase.from('players').update({ position: squareIndex }).eq('id', players.id);
          console.log(`✅ Moved ${players.name} to square ${squareIndex}`);
          return;
        }
        
        const { data: player } = await supabase.from('players').select('*').eq('id', userId).single();
        if (!player) {
          console.error('❌ Player not found');
          return;
        }
        
        const square = BOARD_LAYOUT[squareIndex];
        console.log(`🎲 MOVING TO SQUARE ${squareIndex}:`, {
          label: square.label,
          type: square.type,
          subLabel: square.subLabel
        });
        
        await supabase.from('players').update({ position: squareIndex }).eq('id', player.id);
        console.log(`✅ Moved ${player.name} to square ${squareIndex} (${square.label})`);
      } catch (err) {
        console.error('❌ Error moving to square:', err);
      }
    },
    
    /**
     * Show all board squares with their indices
     */
    showSquares: () => {
      console.log(`
🎲 BOARD SQUARES (24 total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);
      BOARD_LAYOUT.forEach((sq, idx) => {
        console.log(`[${String(idx).padStart(2, '0')}] ${sq.label.padEnd(20)} - ${sq.type.padEnd(15)} (${sq.subLabel})`);
      });
      console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Usage: await window.__GAME_TEST__.moveToSquare(5)
      `);
    },
    
    /**
     * Logs voting weight state
     */
    logVotingWeight: (player: any) => {
      console.log('🗳️ VOTING WEIGHT STATE:', {
        playerId: player.id,
        playerName: player.name,
        baseWeight: player.class === 'Worker' || player.class === 'Politician' ? 2 : 1,
        bonus_voting_weight: player.bonus_voting_weight,
        total: (player.class === 'Worker' || player.class === 'Politician' ? 2 : 1) + (player.bonus_voting_weight || 0)
      });
    },
    
    /**
     * Lists all available test commands
     */
    help: () => {
      console.log(`
🧪 TEST MODE HELPERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Usage: window.__GAME_TEST__.<command>()

COMMANDS:
  - moveToSquare(0-23)          Move to any board square (0=GO, 12=SALARY)
  - showSquares()               List all board squares with indices
  - logVotingWeight(player)     Log voting weight for a player
  - log(label, data)            Test log with label
  
BROWSER CONSOLE TIPS:
  - Press F12 to open Dev Tools
  - Check Console for all 💰💵🗳️🧪 debug logs
  - Filter by emoji prefix (🗳️ VOTING WEIGHT, 💵 MIN_SALARY, etc)
  - Use await for async commands
  
EXAMPLES:
  await window.__GAME_TEST__.moveToSquare(6)     // Move to square 6 (CHANCE)
  window.__GAME_TEST__.showSquares()             // Show all squares
  
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);
    }
  };
}

export default { isTestMode, log };
