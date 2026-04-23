import { useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useGameStore } from './useGameStore';
import { GameState, Player } from '../types/game';

export const useGameSync = (gameId: string) => {
  const { setGame, setPlayers, updatePlayer, updateGameState } = useGameStore();

  useEffect(() => {
    if (!gameId) return;

    const fetchData = async () => {
      const { data: gameData } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();
      
      const { data: playerData } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', gameId);

      if (gameData) setGame(gameData as GameState);
      if (playerData) setPlayers(playerData as Player[]);
    };

    fetchData();

    const gameSubscription = supabase
      .channel(`game:${gameId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => {
          updateGameState(payload.new as GameState);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            updatePlayer(payload.new.id, payload.new as Player);
          } else if (payload.eventType === 'INSERT') {
            fetchData();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(gameSubscription);
    };
  }, [gameId, setGame, setPlayers, updatePlayer, updateGameState]);
};
