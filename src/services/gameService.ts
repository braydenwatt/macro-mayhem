import { supabase } from './supabase';
import { PlayerClass, GameState, Player, SquareType, BusinessOwnership, EconomicIndicator } from '../types/game';
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
  { id: 'public_campaign', name: 'Public Campaign', cost_multiplier: 2, description: 'Gain public support. Popularity +1.', unpaid_effect: 'NONE', target_class: 'all' },
  { id: 'stimulus', name: 'Local Stimulus', cost_multiplier: 3, description: 'Inject capital into local projects. GDP +1.', unpaid_effect: 'NONE', target_class: 'all' },
  { id: 'job_training', name: 'Job Training', cost_multiplier: 3, description: 'Funding for workers. Unemployment -1.', unpaid_effect: 'NONE', target_class: 'all' },
];

const clampIndicator = (value: number) => Math.max(1, Math.min(10, value));

const isBusinessSquare = (type: SquareType) => type === 'VACATION' || type === 'PAY_EXPENSES';

export const meetsWinCondition = (player: Player, gdp: number, inflation: number, unemployment: number): boolean => {
  switch (player.class) {
    case 'Worker':
      return unemployment <= 2 && player.balance >= 150;
    case 'Businessman':
      return player.balance >= 500;
    case 'Banker':
      return inflation === 3 && unemployment <= 4;
    case 'Politician':
      return player.popularity >= 7 && inflation <= 5;
    default:
      return false;
  }
};

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
      Worker: 2,
      Businessman: 1,
      Banker: 1,
      Politician: 1
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
          popularity: playerClass === 'Politician' ? 0 : (playerClass === 'Worker' ? 3 : 0),
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

    if (game.worker_strike_active && (player.class !== 'Banker' && player.class !== 'Politician')) {
      const strikeMessage = `Could not collect salary while the worker strike is active.`;
      await this.logAction(game.id, playerId, 'STRIKE', strikeMessage);
      await supabase.from('games').update({ last_action_message: strikeMessage }).eq('id', game.id);
      return;
    }

    const baseSalary = calculateSalary(player.class, game.gdp, game.inflation, game.unemployment, player.popularity, game.tax_rate, game.min_salary);
    const finalPayout = calculateSalaryPayout(baseSalary, isLanding);

    if (player.class === 'Worker') {
      await supabase.from('players').update({
        popularity: Math.min(10, player.popularity + 1),
        unemployment_roll_pending: true,
      }).eq('id', playerId);

      await this.logAction(game.id, playerId, 'POPULARITY', `Gained 1 Public Approval from passing/landing on SALARY.`);
      await this.logAction(game.id, playerId, 'SALARY', `Reached a SALARY square. Unemployment roll required!`);
    } else {      await supabase.from('players').update({ 
        balance: player.balance + finalPayout
      }).eq('id', playerId);
      
      const landingMsg = isLanding ? " (LANDED!)" : "";
      await this.logAction(game.id, playerId, 'SALARY', `Received a salary of $${finalPayout}${landingMsg}.`);
    }

    if (player.class === 'Banker' && player.position === 0) {
      await supabase.from('players').update({ banker_go_pending: true }).eq('id', playerId);
      const bankerMessage = `Passed GO and may shift GDP, inflation, or unemployment.`;
      await this.logAction(game.id, playerId, 'BANKER_GO', bankerMessage);
      await supabase.from('games').update({ last_action_message: bankerMessage }).eq('id', game.id);
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
    await this.logAction(game.id, playerId, 'SALARY', `Rolled a ${roll} for unemployment: ${resultMsg}`);
    
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

    const { data: ownership } = await supabase.from('businesses').select('*').eq('game_id', game.id).eq('square_index', player.pending_square_index ?? -1).maybeSingle();
    const ownerId = ownership?.player_id || null;

    const currentSalary = calculateSalary(player.class, game.gdp, game.inflation, game.unemployment, player.popularity, game.tax_rate, game.min_salary);
    
    let message = "";
    if (type === 'VACATION') {
      const amount = Math.floor((roll * currentSalary) / 5);
      await supabase.from('players').update({ 
        balance: player.balance - amount 
      }).eq('id', playerId);
      if (ownerId) {
        const { data: owner } = await supabase.from('players').select('balance,name').eq('id', ownerId).single();
        if (owner) {
          await supabase.from('players').update({ balance: owner.balance + amount }).eq('id', ownerId);
          message = `Went on VACATION! Rolled ${roll} and paid $${amount} to ${owner.name}.`;
        }
      }
      if (!message) message = `Went on VACATION! Rolled ${roll} and paid $${amount}.`;
    } else {      // PAY_EXPENSES logic is handled via resolveExpenseChoice now
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
    const { data: ownership } = await supabase.from('businesses').select('*').eq('game_id', game.id).eq('square_index', player.pending_square_index ?? -1).maybeSingle();
    const ownerId = ownership?.player_id || null;

    const allCards = [...CHEAP_EXPENSES, ...SPECIAL_EXPENSES];
    const card = allCards.find(c => c.id === cardId);
    if (!card) return;

    const currentSalary = calculateSalary(player.class, game.gdp, game.inflation, game.unemployment, player.popularity, game.tax_rate, game.min_salary);
    const baseCost = Math.floor(currentSalary / 5);
    const totalCost = card.cost_multiplier * baseCost;

    const paidAmount = totalCost;
    await supabase.from('players').update({ balance: player.balance - paidAmount }).eq('id', playerId);
    if (ownerId) {
      const { data: owner } = await supabase.from('players').select('balance,name').eq('id', ownerId).single();
      if (owner) {
        await supabase.from('players').update({ balance: owner.balance + paidAmount }).eq('id', ownerId);
      }
    }

    let effectMsg = "";
    // Apply card effects
    if (card.id === 'price_controls') {
      await supabase.from('games').update({ inflation: Math.max(1, game.inflation - 1) }).eq('id', game.id);
      effectMsg = " (Inflation ↓)";
    } else if (card.id === 'pr_campaign') {
      const newWeight = (player.bonus_voting_weight || 0) + 1;
      await supabase.from('players').update({ bonus_voting_weight: newWeight }).eq('id', playerId);
      effectMsg = " (+1 Voting Weight next round)";
    } else if (card.id === 'community_fund' || card.id === 'public_campaign') {
      if (player.class === 'Politician' || player.class === 'Worker') {
        await supabase.from('players').update({ popularity: Math.min(10, player.popularity + 1) }).eq('id', playerId);
        effectMsg = " (Popularity ↑)";
      } else {
        effectMsg = " (No Effect)";
      }
    } else if (card.id === 'stimulus') {
      await supabase.from('games').update({ gdp: Math.min(10, game.gdp + 1) }).eq('id', game.id);
      effectMsg = " (GDP ↑)";
    } else if (card.id === 'job_training') {
      await supabase.from('games').update({ unemployment: Math.max(1, game.unemployment - 1) }).eq('id', game.id);
      effectMsg = " (Unemployment ↓)";
    }

    const ownerMessage = ownerId ? ` The payment went to the business owner instead of the bank.` : '';
    const message = `Chose "${card.name}" and paid $${paidAmount}.${effectMsg}${ownerMessage}`;
    await this.logAction(game.id, playerId, 'EXPENSE', message);
    await supabase.from('games').update({ last_action_message: message }).eq('id', game.id);
    await this.clearEventRollPending(playerId);
    await supabase.from('players').update({ pending_square_index: null }).eq('id', playerId);
  },

  async clearEventRollPending(playerId: string): Promise<void> {
    await supabase.from('players').update({ event_roll_pending: null, pending_square_index: null }).eq('id', playerId);
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
    const { data: gameCheck } = await supabase.from('games').select('square_action_resolved').eq('id', gameId).single();
    if (gameCheck?.square_action_resolved) {
      console.log('Square action already resolved for this turn.');
      return;
    }
    await supabase.from('games').update({ square_action_resolved: true }).eq('id', gameId);

    const { data: player } = await supabase.from('players').select('*').eq('id', playerId).single();    if (!player) return;

    let message = "";
    switch (type) {
      case 'GO':
        return;

      case 'VACATION':
        await supabase.from('players').update({ event_roll_pending: 'VACATION', pending_square_index: player.position }).eq('id', playerId);
        return;

      case 'PAY_EXPENSES':
        await supabase.from('players').update({ event_roll_pending: 'PAY_EXPENSES', pending_square_index: player.position }).eq('id', playerId);
        return;

      case 'CHANCE':
        return this.triggerChance(gameId, playerId);

      case 'POLICY_VOTE':
        message = `Triggered a POLICY VOTE! All players must negotiate.`;
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

    // Weighted Random Selection
    const totalWeight = cards.reduce((sum, c) => sum + (c.weight || 5), 0);
    let random = Math.random() * totalWeight;
    let card = cards[0];
    for (const c of cards) {
      if (random < (c.weight || 5)) {
        card = c;
        break;
      }
      random -= (c.weight || 5);
    }

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
      last_action_message: `CHANCE: triggered "${card.name}"!`
    };
    await supabase.from('games').update(chanceData).eq('id', gameId);

    const { data: allPlayers } = await supabase.from('players').select('*').eq('game_id', gameId);
    const triggerPlayerDescriptions: string[] = [];
    const otherPlayersDescriptions: string[] = [];
    let politicianPopDesc = '';

    for (const p of (allPlayers || [])) {
      let mDelta = 0;
      let pDelta = 0;
      let pDescriptions: string[] = [];

      // Popularity modifications always affect the Politician and are logged separately
      if (p.class === 'Politician' && card.popularity_mod !== 0) {
        pDelta = card.popularity_mod;
        // Even if the value is clamped to 0 later, we log the nominal loss/gain for clarity
        politicianPopDesc = `politician ${pDelta > 0 ? 'gained' : 'lost'} ${Math.abs(pDelta)} popularity points`;
      }

      // Robbery and Car Breakdown only affect the drawing player
      if (p.id === playerId) {
        if (card.id === 'robbery') {
          mDelta = -Math.floor(p.balance / 2);
          pDescriptions.push(`lost half their balance (-$${Math.abs(mDelta)})`);
        } else if (card.id === 'car_breakdown') {
          mDelta = -20;
          pDescriptions.push(`lost -$${Math.abs(mDelta)}`);
        }
      }

      // Target-based money delta applies to anyone matching the target
      if (card.money_target === 'all' || card.money_target === p.class.toLowerCase()) {
        if (card.id !== 'robbery' && card.id !== 'car_breakdown') {
          mDelta += card.money_delta;
        }
      }

      if (mDelta !== 0 && card.id !== 'robbery' && card.id !== 'car_breakdown') {
        pDescriptions.push(`${mDelta > 0 ? 'gained' : 'lost'} $${Math.abs(mDelta)}`);
      }

      if (pDescriptions.length > 0) {
        const descStr = pDescriptions.join(' and ');
        if (p.id === playerId) {
          triggerPlayerDescriptions.push(descStr);
        } else {
          otherPlayersDescriptions.push(`${p.class.toLowerCase()} ${descStr}`);
        }
      }

      if (mDelta !== 0 || pDelta !== 0) {
        const pChanceData = {
          balance: p.balance + mDelta,
          popularity: Math.min(10, Math.max(0, p.popularity + pDelta))
        };
        await supabase.from('players').update(pChanceData).eq('id', p.id);
      }
    }

    const triggerPlayerEffectsStr = triggerPlayerDescriptions.length > 0 ? `, ${player.name} ${triggerPlayerDescriptions.join(' and ')}` : '';
    
    // Mix other players and politician pop desc
    const combinedOthers: string[] = [];
    if (politicianPopDesc) combinedOthers.push(politicianPopDesc);
    combinedOthers.push(...otherPlayersDescriptions);
    
    const otherPlayersStr = combinedOthers.length > 0 ? `, ${combinedOthers.join(', ')}` : '';
    const globalEffectsStr = effects.length > 0 ? ` [${effects.join(', ')}]` : '';
    const fullLogMsg = `Triggered ${card.name}${triggerPlayerEffectsStr}${otherPlayersStr}${globalEffectsStr}`;
    
    await this.logAction(gameId, playerId, 'CHANCE', fullLogMsg);
    await supabase.from('games').update({ last_action_message: `CHANCE: ${fullLogMsg}` }).eq('id', gameId);
  },

  async startPolicyVote(gameId: string): Promise<void> {
    const { data: game } = await supabase.from('games').select('next_policy_id').eq('id', gameId).single();
    const { data: cards } = await supabase.from('policy_cards').select('id, weight');
    if (!cards || cards.length === 0) return;

    const currentId = game?.next_policy_id || cards[Math.floor(Math.random() * cards.length)].id;
    const otherCards = cards.filter(c => c.id !== currentId);
    const pool = otherCards.length > 0 ? otherCards : cards;

    // Weighted random selection for nextId
    const totalWeight = pool.reduce((sum, c) => sum + (c.weight || 5), 0);
    let random = Math.random() * totalWeight;
    let nextId = pool[0].id;
    for (const c of pool) {
      if (random < (c.weight || 5)) {
        nextId = c.id;
        break;
      }
      random -= (c.weight || 5);
    }

    const voteData = { 
      current_policy_id: currentId,
      next_policy_id: nextId,
      voting_active: true,
      policy_vote_start: new Date().toISOString()
    };
    await supabase.from('games').update(voteData).eq('id', gameId);
    await supabase.from('players').update({ vote_confirmed: false }).eq('game_id', gameId);
    await supabase.from('policy_bids').delete().eq('game_id', gameId);
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
    },

    async confirmVoteReady(gameId: string, playerId: string): Promise<void> {
    await supabase.from('players').update({ vote_confirmed: true }).eq('id', playerId);

    // Check if all players are ready
    const { data: players } = await supabase.from('players').select('vote_confirmed').eq('game_id', gameId);
    if (players && players.every(p => p.vote_confirmed)) {
     await this.resolvePolicyVote(gameId);
    }
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
        
        let tradeMsg = `${target.name} accepted ${proposer.name}'s offer and voted ${trade.forced_vote}!`;
        if (proposer.class === 'Worker' && trade.popularity_offered > 0) {
          tradeMsg = `${proposer.name} used public endorsement to coerce ${target.name}'s vote to ${trade.forced_vote}! ${target.name} gained ${trade.popularity_offered} popularity.`;
        }
        await this.logAction(trade.game_id, target.id, 'TRADE', tradeMsg);
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
    if (!game || !bids || !game.voting_active || !game.current_policy_id) return;

    const policy = (game as any).policy_cards;
    if (!policy) return;

    let passed = false;

    if (forcedOutcome) {
      passed = forcedOutcome === 'YES';
    } else {
      let yesWeight = 0;
      let noWeight = 0;

      for (const bid of bids) {
        const p = bid.players;
        const weight = (p.base_voting_weight || 1) + (p.bonus_voting_weight || 0);
        if (bid.vote === 'YES') yesWeight += weight;
        else noWeight += weight;
      }
      passed = yesWeight > noWeight;
      if (yesWeight === noWeight) {
        const politicianBid = bids.find(b => b.players.class === 'Politician');
        if (politicianBid?.vote === 'YES') passed = true;
      }
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
      if (policy.min_salary_set && policy.min_salary_set > 0) {
        (gdpUpdate as any).worker_strike_active = false;
      }
      await supabase.from('games').update(gdpUpdate).eq('id', gameId);

      const { data: players } = await supabase.from('players').select('*').eq('game_id', gameId);
      for (const p of (players || [])) {
        let delta = 0;
        if (policy.money_target === 'all') delta = policy.money_delta;
        else if (policy.money_target === p.class.toLowerCase()) delta = policy.money_delta;
        if (delta !== 0) await supabase.from('players').update({ balance: p.balance + delta }).eq('id', p.id);
      }
    }

    // Reset vote state
    await supabase.from('players').update({ vote_confirmed: false, financial_stress: false, bonus_voting_weight: 0 }).eq('game_id', gameId);
    await supabase.from('policy_bids').delete().eq('game_id', gameId);
    await supabase.from('policy_trades').delete().eq('game_id', gameId);
    await supabase.from('games').update({ voting_active: false, current_policy_id: null, policy_vote_start: null }).eq('id', gameId);

    let resultMsg = `The policy "${policy.name}" has ${passed ? 'PASSED' : 'FAILED'}.`;
    if (passed && policy.min_salary_set) {
      resultMsg += ` Minimum wage increased by $${policy.min_salary_set}, boosting Worker salaries!`;
    }
    if (passed && policy.min_salary_set && policy.min_salary_set > 0 && game.worker_strike_active) {
      resultMsg += ` The worker strike has ended.`;
    }
    await this.logAction(gameId, '', 'VOTE_RESULT', resultMsg);
    await supabase.from('games').update({ last_action_message: resultMsg }).eq('id', gameId);
  },

  async useAbility(gameId: string, player: Player, gdp: number, unemployment: number, inflation: number, param?: any): Promise<void> {
    if (player.has_acted_this_year) return;

    try {
      let playerUpdate = {}, gameUpdate = {};
      let actionMessage = '';
      let actionType = 'ABILITY';
      
      switch (player.class) {
        case 'Worker':
          if (player.balance < 30) return;
          playerUpdate = { balance: player.balance - 30, has_acted_this_year: true };
          gameUpdate = { 
            unemployment: Math.min(10, unemployment + 1),
            gdp: Math.max(1, gdp - 1),
            worker_strike_active: true,
            last_action_message: `Called a STRIKE! Worker and Businessman salaries are frozen until minimum wage rises.`
          };
          actionMessage = `Called a STRIKE! Worker and Businessman salaries are frozen until minimum wage rises.`;
          actionType = 'STRIKE';
          break;
        case 'Businessman':
          return;
        case 'Banker':
          return;
        case 'Politician':
          break;
      }
      
      await supabase.from('players').update(playerUpdate).eq('id', player.id);
      await supabase.from('games').update(gameUpdate).eq('id', gameId);
      if (actionMessage) {
        await this.logAction(gameId, player.id, actionType, actionMessage);
      }
    } catch (e) {
      console.error('Error in useAbility:', e);
    }

  },

  async resolveBankerGoChoice(gameId: string, playerId: string, indicator: EconomicIndicator, direction: 'up' | 'down'): Promise<void> {
    const { data: player } = await supabase.from('players').select('*').eq('id', playerId).single();
    const { data: game } = await supabase.from('games').select('*').eq('id', gameId).single();
    if (!player || !game || player.class !== 'Banker' || !player.banker_go_pending) return;

    const delta = direction === 'up' ? 1 : -1;
    const updates: Partial<GameState> = {};

    if (indicator === 'gdp') updates.gdp = clampIndicator(game.gdp + delta);
    if (indicator === 'inflation') updates.inflation = clampIndicator(game.inflation + delta);
    if (indicator === 'unemployment') updates.unemployment = clampIndicator(game.unemployment + delta);

    const message = `Used their GO power to move ${indicator.toUpperCase()} ${direction === 'up' ? 'up' : 'down'} by 1.`;
    await supabase.from('games').update({ ...updates, last_action_message: message }).eq('id', gameId);
    await supabase.from('players').update({ banker_go_pending: false }).eq('id', playerId);
    await this.logAction(gameId, playerId, 'BANKER_GO', message);
  },

  async purchaseBusiness(gameId: string, playerId: string, squareIndex: number, squareType: SquareType): Promise<void> {
    const { data: player } = await supabase.from('players').select('*').eq('id', playerId).single();
    const { data: game } = await supabase.from('games').select('*').eq('id', gameId).single();
    if (!player || !game || player.class !== 'Businessman' || player.has_acted_this_year) return;
    if (player.balance < 100 || !isBusinessSquare(squareType)) return;

    const { data: existing } = await supabase.from('businesses').select('*').eq('game_id', gameId).eq('square_index', squareIndex).maybeSingle();
    if (existing) return;

    await supabase.from('businesses').insert({
      game_id: gameId,
      player_id: playerId,
      square_index: squareIndex
    });

    const nextBalance = player.balance - 100;
    const message = `Purchased a business on square ${squareIndex} for $100.`;

    await supabase.from('players').update({ balance: nextBalance, has_acted_this_year: true }).eq('id', playerId);
    await supabase.from('games').update({ last_action_message: message }).eq('id', gameId);
    await this.logAction(gameId, playerId, 'BUSINESS', message);
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
    await supabase.from('games').update({ 
      last_roll: roll, 
      has_rolled: true,
      square_action_resolved: false 
    }).eq('id', gameId);

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
          current_player_id: latestPlayers[0].id, // Reset to first player in order
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

    return players.filter((player) => meetsWinCondition(player, gdp, inflation, unemployment));
  }
};
