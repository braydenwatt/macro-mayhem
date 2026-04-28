import { supabase } from './supabase';
import { PlayerClass, GameState, Player, SquareType } from '../types/game';
import { calculateSalary, calculateSalaryPayout } from '../engine/economy';
import { ExpenseCard } from '../types/game';

export const CHEAP_EXPENSES: ExpenseCard[] = [
  { id: 'groceries', name: 'Basic Groceries', cost_multiplier: 1, description: 'Mandatory sustenance. No major impact.', unpaid_effect: 'STRESS', target_class: 'all' },
  { id: 'utilities', name: 'Utility Bill', cost_multiplier: 1, description: 'Keeping the lights on. Standard cost.', unpaid_effect: 'STRESS', target_class: 'all' },
  { id: 'repairs', name: 'Minor Repairs', cost_multiplier: 1, description: 'Fixing small issues around the house.', unpaid_effect: 'STRESS', target_class: 'all' },
];

export const SPECIAL_EXPENSES: ExpenseCard[] = [
  { id: 'price_controls', name: 'Price Controls', cost_multiplier: 2, description: 'Lobby for regulations. Inflation -1.', unpaid_effect: 'NONE', target_class: 'all' },
  { id: 'pr_campaign', name: 'PR Campaign', cost_multiplier: 3, description: 'Boost your image. +1 Voting Weight next round.', unpaid_effect: 'NONE', target_class: 'all' },
  { id: 'community_fund', name: 'Community Fund', cost_multiplier: 2, description: 'Invest in the district. Popularity +1.', unpaid_effect: 'NONE', target_class: 'all' },
  { id: 'stimulus', name: 'Local Stimulus', cost_multiplier: 3, description: 'Inject capital into local projects. GDP +1.', unpaid_effect: 'NONE', target_class: 'all' },
  { id: 'job_training', name: 'Job Training', cost_multiplier: 3, description: 'Funding for workers. Unemployment -1.', unpaid_effect: 'NONE', target_class: 'all' },
];

export const gameService = {
  async createGame(): Promise<GameState | null> {
    const { data: cards } = await supabase.from('policy_cards').select('id');
    const initialNextPolicyId = cards && cards.length > 0 
      ? cards[Math.floor(Math.random() * cards.length)].id 
      : null;

    const { data, error } = await supabase
      .from('games')
      .insert([
        {
          year: 1,
          turn: 1,
          gdp: 3,
          inflation: 3,
          unemployment: 3,
          status: 'Recession',
          last_roll: 0,
          has_rolled: false,
          started: false,
          tax_rate: 20,
          min_salary: 0,
          next_policy_id: initialNextPolicyId
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating game:', error);
      return null;
    }

    return data as GameState;
  },

  async startGame(gameId: string): Promise<void> {
    console.log('Starting game:', gameId);
    const { error } = await supabase
      .from('games')
      .update({ started: true })
      .eq('id', gameId);
    if (error) console.error('Failed to start game:', error);
  },

  async joinGame(gameId: string, name: string, playerClass: PlayerClass): Promise<Player | null> {
    const votingWeights: Record<PlayerClass, number> = {
      Worker: 1,
      Businessman: 2,
      Banker: 1,
      Politician: 2
    };

    const { data, error } = await supabase
      .from('players')
      .insert([
        {
          game_id: gameId,
          name,
          class: playerClass,
          position: 0,
          balance: 100,
          popularity: playerClass === 'Politician' ? 5 : 0,
          base_voting_weight: votingWeights[playerClass],
          is_waiting_at_go: false,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error joining game:', error);
      return null;
    }

    const { data: players } = await supabase
      .from('players')
      .select('id')
      .eq('game_id', gameId);
    
    if (players?.length === 1) {
      const updateData = { current_player_id: data.id };
      console.log('Updating game current_player_id:', updateData);
      const { error: updateError } = await supabase
        .from('games')
        .update(updateData)
        .eq('id', gameId);
      if (updateError) console.error('Failed to update current_player_id:', updateError);
    }

    return data as Player;
  },

  async logAction(gameId: string, playerId: string, type: string, message: string): Promise<void> {
    await supabase.from('action_logs').insert({
      game_id: gameId,
      player_id: playerId === '' ? null : playerId,
      action_type: type,
      message
    });
  },

  async processSalaryPayout(playerId: string, isLanding: boolean): Promise<void> {
    const { data: player } = await supabase.from('players').select('*').eq('id', playerId).single();
    if (!player) return;

    const { data: game } = await supabase.from('games').select('*').eq('id', player.game_id).single();
    if (!game) return;

    const baseSalary = calculateSalary(player.class, game.gdp, game.inflation, game.unemployment, player.popularity, game.tax_rate, game.min_salary);
    const finalPayout = calculateSalaryPayout(baseSalary, isLanding);

    if (player.class === 'Worker') {
      await supabase.from('players').update({ 
        unemployment_roll_pending: true,
      }).eq('id', playerId);
      
      await this.logAction(game.id, playerId, 'SALARY', `${player.name} reached a SALARY square. Unemployment roll required!`);
    } else {
      await supabase.from('players').update({ 
        balance: player.balance + finalPayout
      }).eq('id', playerId);
      
      const landingMsg = isLanding ? " (LANDED!)" : "";
      await this.logAction(game.id, playerId, 'SALARY', `${player.name} received a salary of $${finalPayout}${landingMsg}.`);
    }
  },

  async resolveWorkerUnemployment(playerId: string, roll: number, isLanding: boolean): Promise<{isUnemployed: boolean, finalPayout: number, roll: number} | null> {
    const { data: player } = await supabase.from('players').select('*').eq('id', playerId).single();
    if (!player || player.class !== 'Worker') return null;

    const { data: game } = await supabase.from('games').select('*').eq('id', player.game_id).single();
    if (!game) return null;

    let isUnemployed = false;
    if (game.unemployment >= 9 && roll >= 3) isUnemployed = true;
    else if (game.unemployment >= 7 && roll >= 4) isUnemployed = true;
    else if (game.unemployment >= 5 && roll >= 5) isUnemployed = true;
    else if (game.unemployment >= 3 && roll >= 6) isUnemployed = true;

    const baseSalary = calculateSalary(player.class, game.gdp, game.inflation, game.unemployment, player.popularity, game.tax_rate, game.min_salary);
    let finalPayout = isUnemployed ? 0 : calculateSalaryPayout(baseSalary, isLanding);
    
    // Apply minimum salary floor even when unemployed
    if (game.min_salary > finalPayout) {
      finalPayout = game.min_salary;
    }

    await supabase.from('players').update({ 
      balance: player.balance + finalPayout
    }).eq('id', playerId);

    let resultMsg = isUnemployed ? `UNEMPLOYED this cycle but received $${finalPayout} (minimum wage protection).` : `Received $${finalPayout} salary.`;
    if (isUnemployed && game.min_salary > 0) {
      resultMsg = `UNEMPLOYED this cycle but received $${finalPayout} (minimum wage).`;
    }
    await this.logAction(game.id, playerId, 'SALARY', `${player.name} rolled a ${roll} for unemployment: ${resultMsg}`);
    
    return { isUnemployed, finalPayout, roll };
  },

  async clearUnemploymentPending(playerId: string): Promise<void> {
    await supabase.from('players').update({ unemployment_roll_pending: false }).eq('id', playerId);
  },

  async resolveEventRoll(playerId: string, type: 'VACATION' | 'PAY_EXPENSES', roll: number): Promise<void> {
    const { data: player } = await supabase.from('players').select('*').eq('id', playerId).single();
    if (!player) return;

    const { data: game } = await supabase.from('games').select('*').eq('id', player.game_id).single();
    if (!game) return;

    const currentSalary = calculateSalary(player.class, game.gdp, game.inflation, game.unemployment, player.popularity, game.tax_rate, game.min_salary);
    
    let message = "";
    if (type === 'VACATION') {
      const amount = Math.floor((roll * currentSalary) / 5);
      await supabase.from('players').update({ 
        balance: Math.max(0, player.balance - amount)
      }).eq('id', playerId);
      message = `${player.name} went on VACATION! Rolled ${roll} and paid $${amount}.`;
    } else {
      // PAY_EXPENSES logic is handled via resolveExpenseChoice now
      return;
    }

    await this.logAction(game.id, playerId, type, message);
    await supabase.from('games').update({ last_action_message: message }).eq('id', game.id);
  },

  async resolveExpenseChoice(playerId: string, cardId: string): Promise<void> {
    const { data: player } = await supabase.from('players').select('*').eq('id', playerId).single();
    if (!player) return;
    const { data: game } = await supabase.from('games').select('*').eq('id', player.game_id).single();
    if (!game) return;

    const allCards = [...CHEAP_EXPENSES, ...SPECIAL_EXPENSES];
    const card = allCards.find(c => c.id === cardId);
    if (!card) return;

    const currentSalary = calculateSalary(player.class, game.gdp, game.inflation, game.unemployment, player.popularity, game.tax_rate, game.min_salary);
    const baseCost = Math.floor(currentSalary / 5);
    const totalCost = card.cost_multiplier * baseCost;

    const paidAmount = Math.min(player.balance, totalCost);
    await supabase.from('players').update({ balance: player.balance - paidAmount }).eq('id', playerId);

    let effectMsg = "";
    // Apply card effects
    if (card.id === 'price_controls') {
      await supabase.from('games').update({ inflation: Math.max(1, game.inflation - 1) }).eq('id', game.id);
      effectMsg = " (Inflation ↓)";
    } else if (card.id === 'pr_campaign') {
      const newWeight = (player.bonus_voting_weight || 0) + 1;
      console.log('💰 PR_CAMPAIGN BONUS DEBUG:', {
        playerId,
        oldWeight: player.bonus_voting_weight,
        newWeight,
        player
      });
      await supabase.from('players').update({ bonus_voting_weight: newWeight }).eq('id', playerId);
      const { data: updated } = await supabase.from('players').select('bonus_voting_weight').eq('id', playerId).single();
      console.log('✅ PR_CAMPAIGN POST-UPDATE VERIFICATION:', { updated });
      effectMsg = " (+1 Voting Weight next round)";
    } else if (card.id === 'community_fund') {
      await supabase.from('players').update({ popularity: Math.min(10, player.popularity + 1) }).eq('id', playerId);
      effectMsg = " (Popularity ↑)";
    } else if (card.id === 'stimulus') {
      await supabase.from('games').update({ gdp: Math.min(10, game.gdp + 1) }).eq('id', game.id);
      effectMsg = " (GDP ↑)";
    } else if (card.id === 'job_training') {
      await supabase.from('games').update({ unemployment: Math.max(1, game.unemployment - 1) }).eq('id', game.id);
      effectMsg = " (Unemployment ↓)";
    }

    const message = `${player.name} chose "${card.name}" and paid $${paidAmount}.${effectMsg}`;
    await this.logAction(game.id, playerId, 'EXPENSE', message);
    await supabase.from('games').update({ last_action_message: message }).eq('id', game.id);
    await this.clearEventRollPending(playerId);
  },

  async clearEventRollPending(playerId: string): Promise<void> {
    await supabase.from('players').update({ event_roll_pending: null }).eq('id', playerId);
  },

  async resolveSquare(
    gameId: string, 
    playerId: string, 
    type: SquareType, 
    gdp: number, 
    inflation: number,
    unemployment: number,
    popularity: number,
    taxRate: number,
    minSalary: number
  ): Promise<void> {
    const { data: player } = await supabase.from('players').select('*').eq('id', playerId).single();
    if (!player) return;

    let message = "";
    switch (type) {
      case 'GO':
        return;

      case 'VACATION':
        await supabase.from('players').update({ event_roll_pending: 'VACATION' }).eq('id', playerId);
        return;

      case 'PAY_EXPENSES':
        const currentSalary = calculateSalary(player.class, gdp, inflation, unemployment, popularity, taxRate, minSalary);
        const baseCost = Math.floor(currentSalary / 5);
        if (player.balance < baseCost) {
          message = `${player.name} could not afford any expenses!`;
          await this.logAction(gameId, playerId, 'EXPENSE', message);
          await supabase.from('games').update({ last_action_message: message }).eq('id', gameId);
          return;
        }
        await supabase.from('players').update({ event_roll_pending: 'PAY_EXPENSES' }).eq('id', playerId);
        return;

      case 'CHANCE':
        return this.triggerChance(gameId, playerId);

      case 'POLICY_VOTE':
        message = `${player.name} triggered a POLICY VOTE! All players must negotiate.`;
        await supabase.from('games').update({ last_action_message: message }).eq('id', gameId);
        return this.startPolicyVote(gameId);
    }

    if (message) {
      await this.logAction(gameId, playerId, type, message);
      await supabase.from('games').update({ last_action_message: message }).eq('id', gameId);
    }
  },

  async triggerChance(gameId: string, playerId: string): Promise<void> {
    const { data: cards } = await supabase.from('chance_cards').select('*');
    const { data: player } = await supabase.from('players').select('name').eq('id', playerId).single();
    if (!cards || cards.length === 0 || !player) return;

    const card = cards[Math.floor(Math.random() * cards.length)];
    const { data: game } = await supabase.from('games').select('*').eq('id', gameId).single();
    if (!game) return;

    // Build Descriptive Message
    const effects: string[] = [];
    if (card.gdp_mod !== 0) effects.push(`GDP ${card.gdp_mod > 0 ? '+' : ''}${card.gdp_mod}`);
    if (card.inflation_mod !== 0) effects.push(`INF ${card.inflation_mod > 0 ? '+' : ''}${card.inflation_mod}`);
    if (card.unemployment_mod !== 0) effects.push(`UNP ${card.unemployment_mod > 0 ? '+' : ''}${card.unemployment_mod}`);

    const chanceData = {
      gdp: Math.max(1, Math.min(10, game.gdp + card.gdp_mod)),
      inflation: Math.max(1, Math.min(10, game.inflation + card.inflation_mod)),
      unemployment: Math.max(1, Math.min(10, game.unemployment + card.unemployment_mod)),
      last_action_message: `CHANCE: ${player.name} triggered "${card.name}"!`
    };
    await supabase.from('games').update(chanceData).eq('id', gameId);

    const { data: allPlayers } = await supabase.from('players').select('*').eq('game_id', gameId);
    const triggerPlayerDescriptions: string[] = [];
    const otherPlayersDescriptions: string[] = [];

    for (const p of (allPlayers || [])) {
      let mDelta = 0;
      let pDelta = (p.class === 'Politician') ? card.popularity_mod : 0;
      let description = "";

      if (p.id === playerId) {
        if (card.id === 'robbery') {
          mDelta = -Math.floor(p.balance / 2);
          description = `lost half their balance (-$${Math.abs(mDelta)})`;
        } else if (card.id === 'watergate') {
          pDelta = -p.popularity;
          description = `lost all popularity (-${Math.abs(pDelta)} POP)`;
        } else if (card.id === 'car_breakdown') {
          mDelta = -20;
          description = `car broke down (-$${Math.abs(mDelta)})`;
        } else {
          if (card.money_target === 'all' || card.money_target === p.class.toLowerCase()) {
            mDelta = card.money_delta;
            if (mDelta !== 0) {
              description = `${mDelta > 0 ? 'gained' : 'lost'} $${Math.abs(mDelta)}`;
            }
          }
        }
        
        if (pDelta !== 0 && !description.includes('POP')) {
          if (description) description += `, `;
          description += `${pDelta > 0 ? 'gained' : 'lost'} ${Math.abs(pDelta)} popularity`;
        }
        
        if (description) triggerPlayerDescriptions.push(description);
      } else if (card.money_target === 'all') {
        mDelta = card.money_delta;
      } else if (p.class === 'Politician' && card.money_target === 'politician') {
        mDelta = card.money_delta;
      }

      // Track other players' effects (politicians gaining popularity from cards like Gov Efficiency)
      if (p.id !== playerId && pDelta !== 0) {
        otherPlayersDescriptions.push(`${p.name} ${pDelta > 0 ? 'gained' : 'lost'} ${Math.abs(pDelta)} popularity`);
      }

      if (mDelta !== 0 || pDelta !== 0) {
        const pChanceData = {
          balance: Math.max(0, p.balance + mDelta),
          popularity: Math.min(10, Math.max(0, p.popularity + pDelta))
        };
        await supabase.from('players').update(pChanceData).eq('id', p.id);
      }
    }

    const triggerPlayerEffectsStr = triggerPlayerDescriptions.length > 0 ? ` - ${player.name} ${triggerPlayerDescriptions.join(' and ')}` : '';
    const otherPlayersStr = otherPlayersDescriptions.length > 0 ? ` (${otherPlayersDescriptions.join('; ')})` : '';
    const globalEffectsStr = effects.length > 0 ? ` [${effects.join(', ')}]` : '';
    const fullLogMsg = `"${card.name}"${triggerPlayerEffectsStr}${otherPlayersStr}${globalEffectsStr}`;
    
    await this.logAction(gameId, playerId, 'CHANCE', fullLogMsg);
    await supabase.from('games').update({ last_action_message: `CHANCE: ${fullLogMsg}` }).eq('id', gameId);
  },

  async startPolicyVote(gameId: string): Promise<void> {
    const { data: game } = await supabase.from('games').select('next_policy_id').eq('id', gameId).single();
    const { data: cards } = await supabase.from('policy_cards').select('id');
    if (!cards || cards.length === 0) return;

    const currentId = game?.next_policy_id || cards[Math.floor(Math.random() * cards.length)].id;
    const otherCards = cards.filter(c => c.id !== currentId);
    const pool = otherCards.length > 0 ? otherCards : cards;
    const nextId = pool[Math.floor(Math.random() * pool.length)].id;

    const voteData = { 
      current_policy_id: currentId,
      next_policy_id: nextId,
      voting_active: true 
    };
    await supabase.from('games').update(voteData).eq('id', gameId);
    await supabase.from('players').update({ vote_confirmed: false }).eq('game_id', gameId);
  },

  async submitVote(gameId: string, playerId: string, vote: 'YES' | 'NO'): Promise<void> {
    const { data: player } = await supabase.from('players').select('financial_stress').eq('id', playerId).single();
    if (player?.financial_stress) return;

    const { data: game } = await supabase.from('games').select('current_policy_id').eq('id', gameId).single();
    if (!game?.current_policy_id) return;

    const { error } = await supabase.from('policy_bids').upsert({
      game_id: gameId,
      player_id: playerId,
      policy_id: game.current_policy_id,
      vote,
      amount: 0 
    }, { onConflict: 'game_id,player_id,policy_id' });
    
    if (error) console.error('Error submitting vote:', error);
    await supabase.from('players').update({ vote_confirmed: true }).eq('id', playerId);
  },

  async createTrade(gameId: string, proposerId: string, targetId: string, money: number, pop: number, forcedVote: 'YES' | 'NO'): Promise<void> {
    await supabase.from('policy_trades').insert({
      game_id: gameId,
      proposer_id: proposerId,
      target_id: targetId,
      money_offered: money,
      popularity_offered: pop,
      forced_vote: forcedVote,
      status: 'PENDING'
    });
  },

  async cancelTrade(tradeId: string): Promise<void> {
    await supabase.from('policy_trades').delete().eq('id', tradeId);
  },

  async respondToTrade(tradeId: string, accept: boolean): Promise<void> {
    const { data: trade } = await supabase.from('policy_trades').select('*').eq('id', tradeId).single();
    if (!trade || trade.status !== 'PENDING') return;

    if (accept) {
      const { data: proposer } = await supabase.from('players').select('*').eq('id', trade.proposer_id).single();
      const { data: target } = await supabase.from('players').select('*').eq('id', trade.target_id).single();
      const { data: game } = await supabase.from('games').select('current_policy_id').eq('id', trade.game_id).single();
      
      const isProposerWorker = proposer?.class === 'Worker';
      const hasEnoughPop = isProposerWorker || (proposer && proposer.popularity >= trade.popularity_offered);

      if (proposer && target && game?.current_policy_id && proposer.balance >= trade.money_offered && hasEnoughPop) {
        const popCost = isProposerWorker ? 0 : trade.popularity_offered;

        await supabase.from('players').update({ 
          balance: proposer.balance - trade.money_offered,
          popularity: proposer.popularity - popCost
        }).eq('id', proposer.id);

        await supabase.from('players').update({ 
          balance: target.balance + trade.money_offered,
          popularity: Math.min(10, target.popularity + trade.popularity_offered),
          vote_confirmed: true
        }).eq('id', target.id);

        await supabase.from('policy_bids').upsert({
          game_id: trade.game_id,
          player_id: target.id,
          policy_id: game.current_policy_id,
          vote: trade.forced_vote,
          amount: 0
        }, { onConflict: 'game_id,player_id,policy_id' });

        await supabase.from('policy_trades').update({ status: 'ACCEPTED' }).eq('id', tradeId);
        await this.logAction(trade.game_id, target.id, 'TRADE', `${target.name} accepted ${proposer.name}'s offer and voted ${trade.forced_vote}!`);
      }
    } else {
      await supabase.from('policy_trades').update({ status: 'DECLINED' }).eq('id', tradeId);
    }
  },

  async useExecutiveOrder(gameId: string, playerId: string, outcome: 'YES' | 'NO'): Promise<void> {
    const { data: player } = await supabase.from('players').select('*').eq('id', playerId).single();
    if (player?.class === 'Politician' && !player.exec_order_used_this_year) {
      await supabase.from('players').update({ exec_order_used_this_year: true }).eq('id', playerId);
      await supabase.from('games').update({ 
        last_action_message: `EXECUTIVE ORDER: ${player.name} has forced the policy to ${outcome === 'YES' ? 'PASS' : 'FAIL'}!`
      }).eq('id', gameId);
      
      await this.resolvePolicyVote(gameId, outcome);
    }
  },

  async resolvePolicyVote(gameId: string, forcedOutcome?: 'YES' | 'NO'): Promise<void> {
    console.log('Resolving policy vote for game:', gameId, 'Forced:', forcedOutcome);
    const { data: game, error: gErr } = await supabase.from('games').select('*, policy_cards!current_policy_id(*)').eq('id', gameId).single();
    const { data: bids, error: bErr } = await supabase.from('policy_bids').select('*, players(*)').eq('game_id', gameId);
    
    if (gErr || bErr) {
      console.error('Error fetching data for vote resolution:', { gErr, bErr });
      return;
    }
    if (!game || !bids) return;

    const policy = (game as any).policy_cards;
    let passed = false;

    if (forcedOutcome) {
      passed = forcedOutcome === 'YES';
    } else {
      let yesWeight = 0;
      let noWeight = 0;
      const weights: Record<PlayerClass, number> = { Worker: 2, Businessman: 1, Banker: 1, Politician: 1 };

      for (const bid of bids) {
        const p = bid.players;
        const weight = (weights[p.class as PlayerClass] || 1) + (p.bonus_voting_weight || 0);
        if (bid.vote === 'YES') yesWeight += weight;
        else noWeight += weight;
      }
      passed = yesWeight > noWeight;
      if (yesWeight === noWeight) {
        const politicianBid = bids.find(b => b.players.class === 'Politician');
        if (politicianBid?.vote === 'YES') passed = true;
      }
    }

    // POLITICIAN SYNERGY: If Politician voted with Worker
    const workerBid = bids.find(b => b.players.class === 'Worker');
    const politicianBid = bids.find(b => b.players.class === 'Politician');
    if (workerBid && politicianBid && workerBid.vote === politicianBid.vote) {
      const p = politicianBid.players;
      await supabase.from('players').update({ popularity: Math.min(10, p.popularity + 1) }).eq('id', p.id);
      await this.logAction(gameId, p.id, 'POPULARITY', `The Politician voted with the Worker and gained 1 Public Approval!`);
    }

    if (passed) {
      const newMinSalary = policy.min_salary_set !== undefined ? game.min_salary + policy.min_salary_set : game.min_salary;
      const gdpUpdate = {
        gdp: Math.max(1, Math.min(10, game.gdp + policy.gdp_mod)),
        inflation: Math.max(1, Math.min(10, game.inflation + policy.inflation_mod)),
        unemployment: Math.max(1, Math.min(10, game.unemployment + policy.unemployment_mod)),
        tax_rate: Math.max(0, game.tax_rate + (policy.tax_mod || 0)),
        min_salary: newMinSalary
      };
      if (policy.min_salary_set !== undefined) {
        console.log('💵 MIN_SALARY INCREASE DEBUG:', {
          oldMinSalary: game.min_salary,
          minSalarySetValue: policy.min_salary_set,
          newMinSalary,
          policyName: policy.name
        });
      }
      await supabase.from('games').update(gdpUpdate).eq('id', gameId);

      const { data: players } = await supabase.from('players').select('*').eq('game_id', gameId);
      for (const p of (players || [])) {
        let delta = 0;
        if (policy.money_target === 'all') delta = policy.money_delta;
        else if (policy.money_target === p.class.toLowerCase()) delta = policy.money_delta;
        if (delta !== 0) await supabase.from('players').update({ balance: Math.max(0, p.balance + delta) }).eq('id', p.id);
      }
    }

    await supabase.from('players').update({ vote_confirmed: false, financial_stress: false }).eq('game_id', gameId);
    await supabase.from('policy_bids').delete().eq('game_id', gameId);
    await supabase.from('policy_trades').delete().eq('game_id', gameId);
    await supabase.from('games').update({ voting_active: false, current_policy_id: null }).eq('id', gameId);
    await this.logAction(gameId, '', 'VOTE_RESULT', `The policy "${policy.name}" has ${passed ? 'PASSED' : 'FAILED'}.`);
  },

  async useAbility(gameId: string, player: Player, gdp: number, unemployment: number, inflation: number, param?: any): Promise<void> {
    if (player.has_acted_this_year) return;

    try {
      let playerUpdate = {}, gameUpdate = {};
      
      switch (player.class) {
        case 'Worker':
          if (player.balance < 30) return;
          playerUpdate = { balance: player.balance - 30, has_acted_this_year: true };
          gameUpdate = { 
            unemployment: Math.min(10, unemployment + 1),
            gdp: Math.max(1, gdp - 1),
            last_action_message: `${player.name} (Worker) called a STRIKE! Unemployment ↑, GDP ↓.`
          };
          break;
        case 'Businessman':
          if (player.balance < 30) return;
          playerUpdate = { balance: player.balance - 30, has_acted_this_year: true };
          gameUpdate = { 
            gdp: Math.min(10, gdp + 1),
            last_action_message: `${player.name} (Businessman) invested in growth! GDP ↑.`
          };
          break;
        case 'Banker':
          if (player.balance < 40) return;
          const infMod = param === 'down' ? -1 : 1;
          playerUpdate = { balance: player.balance - 40, has_acted_this_year: true };
          gameUpdate = { 
            inflation: Math.max(1, Math.min(10, inflation + infMod)),
            last_action_message: `${player.name} (Banker) ADJUSTED rates! Inflation ${infMod > 0 ? '↑' : '↓'}.`
          };
          break;
        case 'Politician':
          if (player.popularity < 3) return;
          playerUpdate = { popularity: player.popularity - 3, has_acted_this_year: true };
          gameUpdate = { 
            unemployment: Math.max(1, unemployment - 1),
            last_action_message: `${player.name} (Politician) created jobs! Unemployment ↓.`
          };
          break;
      }
      
      await supabase.from('players').update(playerUpdate).eq('id', player.id);
      await supabase.from('games').update(gameUpdate).eq('id', gameId);
    } catch (e) {
      console.error('Error in useAbility:', e);
    }
  },

  async clearActionMessage(gameId: string): Promise<void> {
    await supabase.from('games').update({ last_action_message: null }).eq('id', gameId);
  },

  async rollDice(gameId: string, playerId: string, currentPos: number): Promise<number> {
    const roll = Math.floor(Math.random() * 6) + 1;
    let newPos = (currentPos + roll);
    let isWaiting = false;

    if (newPos >= 24) { 
      newPos = 0; 
      isWaiting = true; 
    }

    await supabase.from('players').update({ position: newPos, is_waiting_at_go: isWaiting }).eq('id', playerId);
    await supabase.from('games').update({ last_roll: roll, has_rolled: true }).eq('id', gameId);

    return roll;
  },

  async endTurn(gameId: string, players: Player[], currentPlayerId: string): Promise<boolean> {
    const currentIndex = players.findIndex(p => p.id === currentPlayerId);
    let nextIndex = (currentIndex + 1) % players.length;
    let nextPlayer = players[nextIndex];

    const { data: latestPlayers } = await supabase.from('players').select('*').eq('game_id', gameId).order('id');
    if (!latestPlayers) return false;

    const totalJoined = latestPlayers.length;
    const waitingAtGo = latestPlayers.filter(p => p.is_waiting_at_go).length;
    const trulyAllWaiting = totalJoined > 0 && waitingAtGo === totalJoined;

    if (trulyAllWaiting) {
      const { data: game } = await supabase.from('games').select('*').eq('id', gameId).single();
      if (game) {
        await supabase.from('games').update({ 
          year: (game.year || 1) + 1,
          current_player_id: nextPlayer.id,
          has_rolled: false,
          last_roll: 0,
          last_action_message: `Year ${game.year} has concluded. Economic cycle reset!`
        }).eq('id', gameId);
        
        await supabase.from('players').update({ 
          is_waiting_at_go: false,
          has_acted_this_year: false,
          exec_order_used_this_year: false,
          unemployed_this_turn: false
        }).eq('game_id', gameId);

        await this.logAction(gameId, '', 'YEAR_END', `Year ${game.year} has concluded.`);
      }
    } else {
      let searchCount = 0;
      while (nextPlayer.is_waiting_at_go && searchCount < players.length) {
        nextIndex = (nextIndex + 1) % players.length;
        nextPlayer = players[nextIndex];
        searchCount++;
      }

      await supabase.from('games').update({ 
        current_player_id: nextPlayer.id,
        has_rolled: false,
        last_roll: 0
      }).eq('id', gameId);
    }

    return true;
  },

  async getWinners(gameId: string, gdp: number, inflation: number, unemployment: number): Promise<Player[]> {
    const { data: players } = await supabase.from('players').select('*').eq('game_id', gameId);
    if (!players) return [];

    return players.filter(p => {
      switch (p.class) {
        case 'Worker':
          return unemployment <= 2 && p.balance >= 150;
        case 'Businessman':
          return gdp >= 4 && p.balance >= 300;
        case 'Banker':
          return inflation === 3 && unemployment !== 5;
        case 'Politician':
          return p.popularity >= 6 && gdp >= 3;
        default:
          return false;
      }
    });
  }
};
