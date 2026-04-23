# MonkeyBusiness: The Eco-Board Game

A tactical 24-space board game where four classes compete to shape the national economy while fulfilling their unique win conditions over a 10-year (10-round) span.

## 📊 The Economic Dashboard
The state of the nation is tracked across three indicators, each ranging from **Level 1 to Level 5**.
- **GDP (Growth):** Levels 4-5 are "Green" for the Businessman.
- **Inflation (Stability):** Level 3 is the "Target" for the Banker.
- **Unemployment (Labor):** Levels 1-2 are "Green" for the Worker.

*Starting Point:* All tracks begin at **Level 3 (Stable)**.

---

## 🎭 The Players & Win Conditions
Win conditions are evaluated **only at the end of Year 10**.

| Class | Base Votes | Win Condition |
| :--- | :---: | :--- |
| **Worker** | 1 | Unemployment Level 1-2 **AND** Balance ≥ $15 |
| **Businessman** | 2 | GDP Level 4-5 **AND** Balance ≥ $30 |
| **Banker** | 1 | Inflation is exactly Level 3 **AND** Unemployment is NOT Level 5 |
| **Politician** | 2* | Popularity ≥ 6 **AND** GDP Level 3+ (*Wins all ties) |

---

## 🔄 The Game Loop (1 Fiscal Year)
Each round (Year) consists of every player completing one lap of the board and stopping at **GO**.

### Phase 1: Income (at GO)
Players collect salary automatically when the decade resolves:
- **Base Salary:** $5
- **Worker Bonus:** +$3 if Unemployment is Low (1-2)
- **Businessman Bonus:** +$5 if GDP is High (4-5)
- **Banker Bonus:** +$4 if Inflation is Target (3)
- **Politician Bonus:** +$2 if Popularity is High (6+)

### Phase 2: Action Phase (Start of Turn)
Once per turn, a player may pay for their **Class Ability**:
- **Worker (Strike):** Pay $3 → Unemployment +1, GDP -1.
- **Businessman (Lobby):** Pay $3 → View top 3 Policies, pick 1 to be the active bill.
- **Banker (Rates):** Pay $4 → Inflation ±1 level.
- **Politician (Order):** Pay 3 Popularity → Force current Policy to pass/fail.

### Phase 3: Movement & Squares
Roll the dice and land on a square:
- **Vacation:** Gain $5 + (GDP Level - 1).
- **Pay Expenses:** Lose $3 + (Inflation Level - 1).
- **Random Chance:** Trigger a Random Event.
- **Policy Vote:** Initiation of the Blind Bid system.

---

## 🗳️ The Policy Vote (Blind Bid)
When a Policy is proposed:
1. **The Bid:** Players secretly choose "YES" or "NO" and commit any amount of money ($).
2. **Calculation:** Total Power = Base Voting Weight + $ Spent ($1 = 1 Vote).
3. **Resolution:** Side with most votes wins. Ties go to the Politician.
4. **Popularity Impact:** Politician gains +1 Popularity if a passed policy moves GDP or Unemployment into the "Green" zone, and loses -1 if moved to "Red".

---

## 🃏 Card Data & Data Storage

### Chance Deck
| Event | GDP | Inflation | Unemp. | Money Impact |
| :--- | :---: | :---: | :---: | :--- |
| **AI Boom** | +1 | 0 | 0 | All gain $2 |
| **Tech Bust** | -2 | 0 | +1 | None |
| **Supply Chain Crisis** | 0 | +2 | 0 | Everyone pays $3 |
| **Energy Discovery** | +1 | -1 | 0 | None |
| **Labor Strike** | 0 | 0 | -1 | Worker gains $5 |
| **Corporate Scandal** | -1 | 0 | 0 | Businessman loses $5 |
| **Gov. Efficiency** | 0 | 0 | 0 | Politician +2 Popularity |
| **Unexpected Tax** | 0 | 0 | 0 | Everyone loses $4 |

### Policy Deck
| Policy | GDP | Inf. | Unemp. | Money Impact |
| :--- | :---: | :---: | :---: | :--- |
| **Stimulus Package** | +1 | +1 | 0 | All gain $2 |
| **Austerity Measures** | -1 | 0 | +1 | All lose $3 |
| **Interest Rate Hike** | -1 | -2 | 0 | Banker gains $3 |
| **Min. Wage Increase** | 0 | +1 | +1 | Worker gains $4 |
| **Infrastructure Project** | +1 | 0 | -1 | All pay $2 |
| **Corporate Tax Cut** | +1 | +1 | 0 | Businessman gains $5 |
| **Green Energy Grant** | +1 | -1 | 0 | None |
| **Welfare Expansion** | 0 | +1 | -1 | Worker gains $3 |

### JSON Storage Schema Example
```json
{
  "id": "policy_stimulus",
  "name": "Stimulus Package",
  "gdp_mod": 1,
  "inflation_mod": 1,
  "unemployment_mod": 0,
  "money_delta": 2,
  "money_target": "all" 
}
```

---

## 🛠️ Technical Constraints
- **Capped Tracks:** Indicators cannot move below 1 or above 5.
- **Crippling Debt:** Balance cannot go below $0. If forced below, it sets to $0.
- **Vote Penalty:** If a player has $0, their Base Voting Weight becomes 0.
- **No Trading:** All cooperation is handled via the Blind Bid.

  Phase 1: Data & Engine Foundation
   1. Database Migration:
       * Update games table: Change gdp, inflation, unemployment to integer with range constraints (1-5).
       * Update players table: Add popularity (int) and base_voting_weight (int).
       * Create policy_deck and chance_deck tables to store the card data provided in the README.
   2. Economy Engine Refactor:
       * Implement level-capping logic (min 1, max 5).
       * Refactor salary calculation in economy.ts to use the new "Base $5 + Class Bonus" rules.
       * Implement "Crippling Debt" logic: set balance to $0 if negative, and zero-out voting weight if balance is $0.

  Phase 2: Action Phase & Squares
   1. Class Abilities:
       * Add a "Class Action" button to the UI.
       * Implement backend logic for each of the 4 unique abilities (Strike, Lobby, Rates, Order).
       * Add an "Info" tooltip next to the button explaining the ability's cost and effect.
   2. Square Resolution:
       * Implement logic for the Vacation square ($5 + GDP bonus).
       * Implement logic for the Pay Expenses square ($3 + Inflation penalty).
       * Create the Random Chance system: Draw a random card from the chance table and apply modifiers to the game state.

  Phase 3: The Policy Voting System
   1. Blind Bid System:
       * Create a bids table to store secret player votes (Yes/No) and their monetary stake.
       * Implement a "Vote Trigger" when a player lands on a Policy square.
       * Build a UI modal for players to submit their secret bid.
   2. Vote Resolution:
       * Implement the calculation logic: (Base Weight + Bid).
       * Handle tie-breaking (Politician priority).
       * Apply the winning Policy's modifiers to the Dashboard.
       * Implement the Politician's Popularity Check (+1/-1 based on Green/Red zones).

  Phase 4: Dashboard & Polish
   1. Economic Dashboard Widget:
       * Build a visual tracker (top of screen) showing the 1-5 levels for GDP, Inflation, and Unemployment.
       * Add "Green/Red" zone indicators for each track.
   2. End Game & Win Conditions:
       * Implement a "Year 10" check.
       * At the end of Year 10, run a final validation script that checks every player against their specific win criteria (e.g., Worker:
         $15 + Unemployment 1-2).
       * Display a "Winner" screen or leaderboard.