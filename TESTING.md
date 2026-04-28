# Testing Macro Mayhem

## Quick Test Mode

Start the dev server with testing helpers:

```bash
npm run dev:test
```

This enables:
- Enhanced console debugging with colored emoji labels
- Window global `__GAME_TEST__` object for easy testing
- More verbose logging for voting weight and min salary changes

## What Gets Logged
- **Teleport to any square for testing specific scenarios**

Open your browser's Developer Tools (F12) and look for these debug messages:

### Voting Weight Updates
```
🗳️ VOTING WEIGHT DEBUG: {...}
💰 PR_CAMPAIGN BONUS DEBUG: {...}
✅ PR_CAMPAIGN POST-UPDATE VERIFICATION: {...}
```

### Minimum Wage Updates
```
💵 MIN_SALARY INCREASE DEBUG: {...}
```

### Game State
```
🎴 [Any other game event logs]
```

## Test Helpers in Console

Once in test mode, access test utilities:

```javascript
// List all available commands
window.__GAME_TEST__.help()

// Check voting weight for a player
window.__GAME_TEST__.logVotingWeight(player)

// Custom logging
window.__GAME_TEST__.log('Label', { data: 'value' })

// MOVE TO ANY SQUARE (async - use await!)
await window.__GAME_TEST__.moveToSquare(0)    // GO square
await window.__GAME_TEST__.moveToSquare(12)   // SALARY square
await window.__GAME_TEST__.moveToSquare(5)    // CHANCE square
```

## Board Squares Reference

```
[00] GO                  - GO              (Collect Salary)
[01] Policy Vote        - POLICY_VOTE     (Cast Your Ballot)
[02] Vacation           - VACATION        (Relax & Recovery)
[03] Pay Expenses       - PAY_EXPENSES    (Bills Due)
[04] Random Chance      - CHANCE          (Market News)
[05] Policy Vote        - POLICY_VOTE     (Cast Your Ballot)
[06] Random Chance      - CHANCE          (Market News)
[07] Pay Expenses       - PAY_EXPENSES    (Bills Due)
[08] Random Chance      - CHANCE          (Market News)
[09] Policy Vote        - POLICY_VOTE     (Cast Your Ballot)
[10] Vacation           - VACATION        (Relax & Recovery)
[11] Pay Expenses       - PAY_EXPENSES    (Bills Due)
[12] SALARY             - GO              (Mid-Year Payout)
[13] Policy Vote        - POLICY_VOTE     (Cast Your Ballot)
[14] Vacation           - VACATION        (Relax & Recovery)
[15] Pay Expenses       - PAY_EXPENSES    (Bills Due)
[16] Random Chance      - CHANCE          (Market News)
[17] Policy Vote        - POLICY_VOTE     (Cast Your Ballot)
[18] Policy Vote        - POLICY_VOTE     (Cast Your Ballot)
[19] Vacation           - VACATION        (Relax & Recovery)
[20] Pay Expenses       - PAY_EXPENSES    (Bills Due)
[21] Random Chance      - CHANCE          (Market News)
[22] Policy Vote        - POLICY_VOTE     (Cast Your Ballot)
[23] Vacation           - VACATION        (Relax & Recovery)
```

## Testing Checklist

### Voting Weight (+1)
1. Start a game with test mode
2. Land on "Pay Expenses" square
3. Choose "PR Campaign" card
4. Check console for `💰 PR_CAMPAIGN BONUS DEBUG`
5. Verify `POST-UPDATE VERIFICATION` shows correct bonus
6. Enter policy voting screen
7. Check "Your Weight" shows `(+1)` bonus

### Minimum Wage Increase ($20)
1. Pass a policy with "Min Wage Increase" (+20)
2. Check console for `💵 MIN_SALARY INCREASE DEBUG`
3. Verify it shows: `oldMinSalary + 20 = newMinSalary`
4. Not: `newMinSalary = 20`
5. When worker becomes unemployed, should get `min_salary` amount

### Testing Specific Squares
1. Open browser console (F12)
2. Call: `await window.__GAME_TEST__.moveToSquare(6)` (CHANCE square)
3. Watch your player token move to that square
4. Any square effects trigger automatically
5. Check console for effects being applied

### Testing PAY_EXPENSES
```javascript
await window.__GAME_TEST__.moveToSquare(3)  // PAY_EXPENSES
```
Then choose an expense card to test bonus_voting_weight effect

### Testing CHANCE Cards
```javascript
await window.__GAME_TEST__.moveToSquare(4)  // CHANCE
```
Randomly triggers one of the chance cards - check console for effects

## Debug Tips

- Filter console by emoji prefix to find specific messages
- Check Network tab to see Supabase updates
- Use `__GAME_TEST__.logVotingWeight(player)` to verify current state
- Look for "POST-UPDATE VERIFICATION" logs to confirm writes to DB
- Use `await` when calling async commands like `moveToSquare`
- Use `showSquares()` to quickly reference square indices
