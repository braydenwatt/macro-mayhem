import { create } from 'zustand';
import { GameState, Player, SquareType } from '../types/game';
import { gameService } from '../services/gameService';

interface GameStore {
  game: GameState | null;
  players: Player[];
  me: Player | null;
  
  setGame: (game: GameState) => void;
  setPlayers: (players: Player[]) => void;
  setMe: (player: Player) => void;
  updatePlayer: (playerId: string, updates: Partial<Player>) => void;
  updateGameState: (updates: Partial<GameState>) => void;
  
  rollDice: () => Promise<void>;
  useAbility: (param?: any) => Promise<void>;
  startGame: () => Promise<void>;
  clearActionMessage: () => Promise<void>;
  resolveSquare: (type: SquareType) => Promise<void>;
  submitBid: (vote: 'YES' | 'NO', amount: number) => Promise<void>;
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

  useAbility: async (param?: any) => {
    const { game, me } = get();
    console.log('Store useAbility called', { hasGame: !!game, hasMe: !!me, turnMatch: game?.current_player_id === me?.id });
    if (!game || !me || game.current_player_id !== me.id) return;
    try {
      console.log('Invoking gameService.useAbility...');
      await gameService.useAbility(game.id, me, game.gdp, game.unemployment, game.inflation, param);
      console.log('gameService.useAbility completed');
    } catch (error) {
      console.error('Use ability failed:', error);
    }
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
    await gameService.resolveSquare(game.id, me.id, type, game.gdp, game.inflation);
  },

  submitBid: async (vote: 'YES' | 'NO', amount: number) => {
    const { game, me } = get();
    if (!game || !me || !game.current_policy_id) return;
    await gameService.submitBid(game.id, me.id, game.current_policy_id, vote, amount);
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

  rollDice: async () => {
    const { game, me } = get();
    if (!game || !me || game.current_player_id !== me.id || game.has_rolled) return;
    await gameService.rollDice(game.id, me.id, me.position);
  },

  endTurn: async () => {
    const { game, me, players } = get();
    if (!game || !me || game.current_player_id !== me.id || !game.has_rolled) return;
    await gameService.endTurn(game.id, players, me.id);
  },

  reset: () => set({ game: null, players: [], me: null }),
}));
