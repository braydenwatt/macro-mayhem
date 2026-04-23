import { supabase } from './supabase';
import { PlayerClass, GameState, Player, SquareType } from '../types/game';

export const gameService = {
  async createGame(): Promise<GameState | null> {
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
          balance: 10,
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

  async resolveSquare(gameId: string, playerId: string, type: SquareType, gdp: number, inflation: number): Promise<void> {
    const { data: player } = await supabase.from('players').select('balance, popularity, class, name').eq('id', playerId).single();
    if (!player) return;

    let message = "";
    switch (type) {
      case 'VACATION':
        const vGain = 5 + (gdp - 1);
        const vData = { balance: player.balance + vGain };
        console.log('VACATION update data:', vData);
        const { error: vErr } = await supabase.from('players').update(vData).eq('id', playerId);
        if (vErr) console.error('VACATION update error:', vErr);
        message = `${player.name} went on VACATION and gained $${vGain}!`;
        break;
      case 'PAY_EXPENSES':
        const eLoss = 3 + (inflation - 1);
        const eData = { balance: Math.max(0, player.balance - eLoss) };
        console.log('PAY_EXPENSES update data:', eData);
        const { error: eErr } = await supabase.from('players').update(eData).eq('id', playerId);
        if (eErr) console.error('PAY_EXPENSES update error:', eErr);
        message = `${player.name} paid $${eLoss} in EXPENSES.`;
        break;
      case 'CHANCE':
        return this.triggerChance(gameId, playerId);
      case 'POLICY_VOTE':
        message = `${player.name} triggered a POLICY VOTE! All players must bid.`;
        const pvData = { last_action_message: message };
        console.log('POLICY_VOTE announcement data:', pvData);
        await supabase.from('games').update(pvData).eq('id', gameId);
        return this.startPolicyVote(gameId);
    }

    if (message) {
      const mData = { last_action_message: message };
      console.log('Update last_action_message data:', mData);
      await supabase.from('games').update(mData).eq('id', gameId);
    }
  },

  async triggerChance(gameId: string, playerId: string): Promise<void> {
    const { data: cards } = await supabase.from('chance_cards').select('*');
    const { data: player } = await supabase.from('players').select('name').eq('id', playerId).single();
    if (!cards || cards.length === 0 || !player) return;

    const card = cards[Math.floor(Math.random() * cards.length)];
    const { data: game } = await supabase.from('games').select('*').eq('id', gameId).single();
    if (!game) return;

    const chanceData = {
      gdp: Math.max(1, Math.min(5, game.gdp + card.gdp_mod)),
      inflation: Math.max(1, Math.min(5, game.inflation + card.inflation_mod)),
      unemployment: Math.max(1, Math.min(5, game.unemployment + card.unemployment_mod)),
      last_action_message: `CHANCE: ${player.name} triggered "${card.name}"! ${card.gdp_mod !== 0 ? `GDP ${card.gdp_mod > 0 ? '↑' : '↓'}` : ''} ${card.inflation_mod !== 0 ? `Inf. ${card.inflation_mod > 0 ? '↑' : '↓'}` : ''}`
    };
    console.log('Trigger CHANCE game update data:', chanceData);
    const { error: cErr } = await supabase.from('games').update(chanceData).eq('id', gameId);
    if (cErr) console.error('CHANCE game update error:', cErr);

    const { data: players } = await supabase.from('players').select('*').eq('game_id', gameId);
    for (const p of (players || [])) {
      let mDelta = 0;
      if (card.money_target === 'all') mDelta = card.money_delta;
      else if (card.money_target === p.class.toLowerCase()) mDelta = card.money_delta;
      let pDelta = (p.class === 'Politician') ? card.popularity_mod : 0;
      if (mDelta !== 0 || pDelta !== 0) {
        const pChanceData = {
          balance: Math.max(0, p.balance + mDelta),
          popularity: Math.min(10, Math.max(0, p.popularity + pDelta))
        };
        console.log(`Updating player ${p.name} from CHANCE:`, pChanceData);
        const { error: pcErr } = await supabase.from('players').update(pChanceData).eq('id', p.id);
        if (pcErr) console.error(`CHANCE player update error for ${p.name}:`, pcErr);
      }
    }
  },

  async startPolicyVote(gameId: string): Promise<void> {
    const { data: cards } = await supabase.from('policy_cards').select('id');
    if (!cards || cards.length === 0) return;

    const policyId = cards[Math.floor(Math.random() * cards.length)].id;
    const voteData = { 
      current_policy_id: policyId,
      voting_active: true 
    };
    console.log('Start policy vote data:', voteData);
    const { error: vErr } = await supabase.from('games').update(voteData).eq('id', gameId);
    if (vErr) console.error('Start policy vote error:', vErr);
  },

  async submitBid(gameId: string, playerId: string, policyId: string, vote: 'YES' | 'NO', amount: number): Promise<void> {
    const { data: player } = await supabase.from('players').select('balance').eq('id', playerId).single();
    if (!player || player.balance < amount) return;

    await supabase.from('policy_bids').insert({
      game_id: gameId,
      player_id: playerId,
      policy_id: policyId,
      vote,
      amount
    });

    const bidPlayerData = { balance: player.balance - amount };
    console.log('Player balance update after bid:', bidPlayerData);
    const { error: bErr } = await supabase.from('players').update(bidPlayerData).eq('id', playerId);
    if (bErr) console.error('Bid player update error:', bErr);
  },

  async resolvePolicyVote(gameId: string): Promise<void> {
    const { data: game } = await supabase.from('games').select('*, policy_cards(*)').eq('id', gameId).single();
    const { data: bids } = await supabase.from('policy_bids').select('*, players(*)').eq('game_id', gameId);
    if (!game || !bids) return;

    const policy = (game as any).policy_cards;
    let yesVotes = 0;
    let noVotes = 0;
    let politicianVote: 'YES' | 'NO' | null = null;

    for (const bid of bids) {
      const player = bid.players;
      const power = player.base_voting_weight + bid.amount;
      if (bid.vote === 'YES') yesVotes += power;
      else noVotes += power;
      if (player.class === 'Politician') politicianVote = bid.vote;
    }

    const passed = yesVotes > noVotes || (yesVotes === noVotes && politicianVote === 'YES');

    if (passed) {
      const gdpUpdate = {
        gdp: Math.max(1, Math.min(5, game.gdp + policy.gdp_mod)),
        inflation: Math.max(1, Math.min(5, game.inflation + policy.inflation_mod)),
        unemployment: Math.max(1, Math.min(5, game.unemployment + policy.unemployment_mod))
      };
      console.log('Policy passed - game stats update:', gdpUpdate);
      const { error: gErr } = await supabase.from('games').update(gdpUpdate).eq('id', gameId);
      if (gErr) console.error('Policy pass game update error:', gErr);

      const { data: players } = await supabase.from('players').select('*').eq('game_id', gameId);
      for (const p of (players || [])) {
        let delta = 0;
        if (policy.money_target === 'all') delta = policy.money_delta;
        else if (policy.money_target === p.class.toLowerCase()) delta = policy.money_delta;
        
        if (delta !== 0) {
          const pMoneyUpdate = { balance: Math.max(0, p.balance + delta) };
          console.log(`Policy passed - player ${p.name} money update:`, pMoneyUpdate);
          await supabase.from('players').update(pMoneyUpdate).eq('id', p.id);
        }

        if (p.class === 'Politician') {
          const greenGDP = (game.gdp + policy.gdp_mod) >= 3;
          const greenUnemp = (game.unemployment + policy.unemployment_mod) <= 2;
          const popDelta = (greenGDP || greenUnemp) ? 1 : -1;
          const pPopUpdate = { popularity: Math.min(10, Math.max(0, p.popularity + popDelta)) };
          console.log('Policy passed - Politician popularity update:', pPopUpdate);
          await supabase.from('players').update(pPopUpdate).eq('id', p.id);
        }
      }
    }

    await supabase.from('policy_bids').delete().eq('game_id', gameId);
    const endVoteData = { voting_active: false, current_policy_id: null };
    console.log('Ending policy vote:', endVoteData);
    await supabase.from('games').update(endVoteData).eq('id', gameId);
  },

  async useAbility(gameId: string, player: Player, gdp: number, unemployment: number, inflation: number, param?: any): Promise<void> {
    console.log('gameService.useAbility call start:', { 
      gameId, 
      playerId: player.id, 
      playerClass: player.class, 
      playerBalance: player.balance, 
      playerHasActed: player.has_acted_this_year,
      gdp,
      unemployment,
      inflation,
      param
    });
    
    if (player.has_acted_this_year) {
      console.warn('Player already acted this year');
      return;
    }

    try {
      let playerUpdate = {}, gameUpdate = {};
      
      switch (player.class) {
        case 'Worker':
          if (player.balance < 3) return;
          playerUpdate = { balance: player.balance - 3, has_acted_this_year: true };
          gameUpdate = { 
            unemployment: Math.min(5, unemployment + 1),
            gdp: Math.max(1, gdp - 1),
            last_action_message: `${player.name} (Worker) called a STRIKE! Unemployment ↑, GDP ↓.`
          };
          break;
        case 'Businessman':
          if (player.balance < 3) return;
          playerUpdate = { balance: player.balance - 3, has_acted_this_year: true };
          gameUpdate = { 
            gdp: Math.min(5, gdp + 1),
            last_action_message: `${player.name} (Businessman) invested in growth! GDP ↑.`
          };
          break;
        case 'Banker':
          if (player.balance < 4) return;
          const infMod = param === 'down' ? -1 : 1;
          playerUpdate = { balance: player.balance - 4, has_acted_this_year: true };
          gameUpdate = { 
            inflation: Math.max(1, Math.min(5, inflation + infMod)),
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
      
      console.log('useAbility - Updating player:', playerUpdate);
      const { error: pErr } = await supabase.from('players').update(playerUpdate).eq('id', player.id);
      if (pErr) console.error('useAbility player update ERROR:', pErr);

      console.log('useAbility - Updating game:', gameUpdate);
      const { error: gErr } = await supabase.from('games').update(gameUpdate).eq('id', gameId);
      if (gErr) console.error('useAbility game update ERROR:', gErr);
      
      console.log('useAbility execution complete');
    } catch (e) {
      console.error('CRITICAL: Error in useAbility database update:', e);
    }
  },

  async clearActionMessage(gameId: string): Promise<void> {
    console.log('Clearing action message for game:', gameId);
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

    const playerRollUpdate = { position: newPos, is_waiting_at_go: isWaiting };
    console.log('Updating player position after roll:', playerRollUpdate);
    const { error: pErr } = await supabase.from('players').update(playerRollUpdate).eq('id', playerId);
    if (pErr) console.error('Roll player update error:', pErr);

    const gameRollUpdate = { last_roll: roll, has_rolled: true };
    console.log('Updating game after roll:', gameRollUpdate);
    const { error: gErr } = await supabase.from('games').update(gameRollUpdate).eq('id', gameId);
    if (gErr) console.error('Roll game update error:', gErr);

    return roll;
  },

  async endTurn(gameId: string, players: Player[], currentPlayerId: string): Promise<boolean> {
    const currentIndex = players.findIndex(p => p.id === currentPlayerId);
    const nextIndex = (currentIndex + 1) % players.length;
    const nextPlayerId = players[nextIndex].id;

    const { data: latestPlayers } = await supabase.from('players').select('is_waiting_at_go, position, name').eq('game_id', gameId);
    
    const totalJoined = latestPlayers?.length || 0;
    const waitingAtGo = latestPlayers?.filter(p => p.is_waiting_at_go).length || 0;
    
    console.log(`Checking year advancement: ${waitingAtGo} / ${totalJoined} players at GO`);
    const trulyAllWaiting = totalJoined > 0 && waitingAtGo === totalJoined;

    if (trulyAllWaiting) {
      console.log('All players at GO - Advancing year');
      const { data: game } = await supabase.from('games').select('*').eq('id', gameId).single();
      const { data: allPlayers } = await supabase.from('players').select('*').eq('game_id', gameId);
      
      if (game && allPlayers) {
        for (const p of allPlayers) {
          let salary = 5;
          if (p.class === 'Worker' && game.unemployment <= 2) salary += 3;
          if (p.class === 'Businessman' && game.gdp >= 4) salary += 5;
          if (p.class === 'Banker' && game.inflation === 3) salary += 4;
          if (p.class === 'Politician' && p.popularity >= 6) salary += 2;
          
          console.log(`Paying salary to ${p.name}: $${salary}`);
          await supabase.from('players').update({ balance: p.balance + salary }).eq('id', p.id);
        }

        const yearEndData = { 
          year: (game.year || 1) + 1,
          current_player_id: nextPlayerId,
          has_rolled: false,
          last_roll: 0,
          last_action_message: `Year ${game.year} has concluded. Salaries paid out!`
        };
        console.log('Advancing game year:', yearEndData);
        await supabase.from('games').update(yearEndData).eq('id', gameId);
        
        console.log('Resetting player waiting states');
        await supabase.from('players').update({ 
          is_waiting_at_go: false,
          has_acted_this_year: false 
        }).eq('game_id', gameId);
      }
    } else {
      const nextTurnData = { 
        current_player_id: nextPlayerId,
        has_rolled: false,
        last_roll: 0
      };
      console.log('Switching to next player turn:', nextTurnData);
      await supabase.from('games').update(nextTurnData).eq('id', gameId);
    }

    return true;
  },

  async getWinners(gameId: string, gdp: number, inflation: number, unemployment: number): Promise<Player[]> {
    const { data: players } = await supabase.from('players').select('*').eq('game_id', gameId);
    if (!players) return [];

    return players.filter(p => {
      switch (p.class) {
        case 'Worker':
          return unemployment <= 2 && p.balance >= 15;
        case 'Businessman':
          return gdp >= 4 && p.balance >= 30;
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
