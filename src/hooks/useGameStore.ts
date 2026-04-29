import { create } from 'zustand';
import { GameState, Player, SquareType, EconomicIndicator } from '../types/game';
import { gameService } from '../services/gameService';

interface GameStore {
  game: GameState | null;
  players: Player[];
  me: Player | null;
  setGame: (game: GameState | null) => void;
  setPlayers: (players: Player[]) => void;
  setMe: (me: Player | null) => void;
  updatePlayer: (playerId: string, updates: Partial<Player>) => void;
  updateGameState: (updates: Partial<GameState>) => void;
  
  rollDice: () => Promise<void>;
  useAbility: (param?: any) => Promise<void>;
  purchaseBusiness: (squareIndex: number, squareType: SquareType) => Promise<void>;
  resolveBankerGoChoice: (indicator: EconomicIndicator, direction: 'up' | 'down') => Promise<void>;
  startGame: () => Promise<void>;
  clearActionMessage: () => Promise<void>;
  resolveSquare: (type: SquareType) => Promise<void>;
  submitVote: (vote: 'YES' | 'NO') => Promise<void>;
  createTrade: (targetId: string, money: number, pop: number, forcedVote: 'YES' | 'NO') => Promise<void>;
  cancelTrade: (tradeId: string) => Promise<void>;
  respondToTrade: (tradeId: string, accept: boolean) => Promise<void>;
  useExecutiveOrder: (outcome: 'YES' | 'NO') => Promise<void>;
  confirmVoteReady: () => Promise<void>;
  resolveEventRoll: (type: 'VACATION' | 'PAY_EXPENSES', roll: number) => Promise<void>;
  resolveExpenseChoice: (cardId: string) => Promise<void>;
  clearUnemploymentPending: () => Promise<void>;
  clearEventRollPending: () => Promise<void>;
  resolvePolicyVote: () => Promise<void>;
  getWinners: () => Promise<Player[]>;
  endTurn: () => Promise<void>;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  players: [],
  me: null,

  setGame: (game) => set({ game }),
  setPlayers: (players) => set({ players }),
  setMe: (me) => set({ me }),
  
  updatePlayer: (playerId, updates) => 
    set((state) => {
      const updatedPlayers = state.players.map((p) => 
        p.id === playerId ? { ...p, ...updates } : p
      );
      const updatedMe = state.me?.id === playerId ? { ...state.me, ...updates } : state.me;
      return { players: updatedPlayers, me: updatedMe };
    }),

  updateGameState: (updates) =>
    set((state) => ({
      game: state.game ? { ...state.game, ...updates } : null,
    })),

  rollDice: async () => {
    const { game, me } = get();
    if (!game || !me || game.current_player_id !== me.id || game.has_rolled) return;
    await gameService.rollDice(game.id, me.id, me.position);
  },

  useAbility: async (param?: any) => {
    const { game, me } = get();
    if (!game || !me) return;
    await gameService.useAbility(game.id, me, game.gdp, game.unemployment, game.inflation, param);
  },

  purchaseBusiness: async (squareIndex: number, squareType: SquareType) => {
    const { game, me } = get();
    if (!game || !me) return;
    await gameService.purchaseBusiness(game.id, me.id, squareIndex, squareType);
  },

  resolveBankerGoChoice: async (indicator: EconomicIndicator, direction: 'up' | 'down') => {
    const { game, me } = get();
    if (!game || !me) return;
    await gameService.resolveBankerGoChoice(game.id, me.id, indicator, direction);
  },

  startGame: async () => {
    const { game } = get();
    if (!game) return;
    await gameService.startGame(game.id);
  },

  clearActionMessage: async () => {
    const { game } = get();
    if (!game) return;
    await gameService.clearActionMessage(game.id);
  },

  resolveSquare: async (type: SquareType) => {
    const { game, me } = get();
    if (!game || !me) return;
    await gameService.resolveSquare(game.id, me.id, type, game.gdp, game.inflation, game.unemployment, me.popularity, game.tax_rate, game.min_salary);
  },

  submitVote: async (vote: 'YES' | 'NO') => {
    const { game, me } = get();
    if (!game || !me) return;
    await gameService.submitVote(game.id, me.id, vote);
  },

  createTrade: async (targetId: string, money: number, pop: number, forcedVote: 'YES' | 'NO') => {
    const { game, me } = get();
    if (!game || !me) return;
    await gameService.createTrade(game.id, me.id, targetId, money, pop, forcedVote);
  },

  cancelTrade: async (tradeId: string) => {
    await gameService.cancelTrade(tradeId);
  },

  respondToTrade: async (tradeId: string, accept: boolean) => {
    await gameService.respondToTrade(tradeId, accept);
  },

  useExecutiveOrder: async (outcome: 'YES' | 'NO') => {
    const { game, me } = get();
    if (!game || !me) return;
    await gameService.useExecutiveOrder(game.id, me.id, outcome);
  },

  confirmVoteReady: async () => {
    const { game, me } = get();
    if (!game || !me) return;
    await gameService.confirmVoteReady(game.id, me.id);
  },

  resolveEventRoll: async (type: 'VACATION' | 'PAY_EXPENSES', roll: number) => {
    const { me } = get();
    if (!me) return;
    await gameService.resolveEventRoll(me.id, type, roll);
  },

  resolveExpenseChoice: async (cardId: string) => {
    const { me } = get();
    if (!me) return;
    await gameService.resolveExpenseChoice(me.id, cardId);
  },

  clearUnemploymentPending: async () => {
    const { me } = get();
    if (!me) return;
    await gameService.clearUnemploymentPending(me.id);
  },

  clearEventRollPending: async () => {
    const { me } = get();
    if (!me) return;
    await gameService.clearEventRollPending(me.id);
  },

  resolvePolicyVote: async () => {
    const { game } = get();
    if (!game) return;
    await gameService.resolvePolicyVote(game.id);
  },

  getWinners: async () => {
    const { game } = get();
    if (!game) return [];
    return await gameService.getWinners(game.id, game.gdp, game.inflation, game.unemployment);
  },

  endTurn: async () => {
    const { game, me, players } = get();
    if (!game || !me || game.current_player_id !== me.id || (!game.has_rolled && !me.is_waiting_at_go)) return;
    await gameService.endTurn(game.id, players, me.id);
  },

  reset: () => set({ game: null, players: [], me: null }),
}));
