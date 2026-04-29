import React, { useState, useEffect } from 'react';
import { GameBoard } from './game/GameBoard';
import { useGameStore } from './hooks/useGameStore';
import { useGameSync } from './hooks/useGameSync';
import { gameService } from './services/gameService';
import { PlayerClass, Player, GameState } from './types/game';
import { getSalaryDetails } from './engine/economy';
import { Users, Plus, Play, UserCircle, Copy, CheckCircle2, Coins, Milestone, Info, LogOut } from 'lucide-react';
import './utils/testHelpers'; // Initialize test mode helpers
import { supabase } from './services/supabase';

const CLASS_INFO: Record<PlayerClass, { tag: string; desc: string; icon: string }> = {
  Worker: {
    tag: "The Laborer",
    desc: "Fixed Weight: 2. Ability: Strike to freeze Businessman and Politician salaries until minimum wage rises. Passive: rolls for unemployment at salary squares. High unemployment risks losing income.",
    icon: "🔨"
  },
  Businessman: {
    tag: "The Investor",
    desc: "Fixed Weight: 1. Ability: Purchase a business and collect rent from vacation and expense squares once per year.",
    icon: "💼"
  },
  Banker: {
    tag: "The Regulator",
    desc: "Fixed Weight: 1. When passing GO, choose GDP, inflation, or unemployment to move by 1.",
    icon: "🏦"
  },
  Politician: {
    tag: "The Leader",
    desc: "Fixed Weight: 1. Ability: Executive Order (Forces policy outcome).",
    icon: "⚖️"
  }
};

function PlayerInventory({ player, game, isMe, position, onLeave }: { player: Player, game: GameState | null, isMe?: boolean, position: 'bottom' | 'top' | 'left' | 'right', onLeave?: () => void }) {
  const containerClasses = {
    bottom: "flex-row w-full h-24 bg-slate-900/90 backdrop-blur-xl border-t border-slate-700 px-8 py-4 items-center justify-between",
    top: "flex-row w-full h-20 bg-slate-900/60 border-b border-slate-800 px-8 py-2 items-center justify-between",
    left: "flex-col w-24 h-full bg-slate-900/40 border-r border-slate-800 py-8 px-2 items-center",
    right: "flex-col w-24 h-full bg-slate-900/40 border-l border-slate-800 py-8 px-2 items-center",
  };

  const salaryInfo = game ? getSalaryDetails(
    player.class,
    game.gdp,
    game.inflation,
    game.unemployment,
    player.popularity,
    game.tax_rate,
    game.min_salary
  ) : null;

  const salarySourceDetails = game ? (() => {
    switch (player.class) {
      case 'Worker': {
        const unemploymentBonus = (5 - game.unemployment) * 10;
        return [
          `Base wage: $30`,
          `Minimum wage floor: +$${game.min_salary}`,
          `Unemployment bonus: ${unemploymentBonus >= 0 ? '+' : '-'}$${Math.abs(unemploymentBonus)}`,
          `Tax rate: -$${salaryInfo?.taxAmount ?? 0}`,
          `Final payout: $${salaryInfo?.finalSalary ?? 0}`,
        ];
      }
      case 'Businessman':
        return [
          `Base wage: $50`,
          `GDP bonus: +$${game.gdp * 10}`,
          `Tax rate: -$${salaryInfo?.taxAmount ?? 0}`,
          `Final payout: $${salaryInfo?.finalSalary ?? 0}`,
        ];
      case 'Banker': {
        return [
          `Base wage: $50`,
          game.inflation === 3 ? 'Inflation bonus: +$50 at perfect stability' : game.inflation > 7 ? 'Inflation penalty: -$20 from hyperinflation' : 'Inflation bonus: none',
          `Tax rate: -$${salaryInfo?.taxAmount ?? 0}`,
          `Final payout: $${salaryInfo?.finalSalary ?? 0}`,
        ];
      }
      case 'Politician':
        return [
          `Base wage: $30`,
          `Popularity bonus: +$${player.popularity * 5}`,
          `Tax rate: -$${salaryInfo?.taxAmount ?? 0}`,
          `Final payout: $${salaryInfo?.finalSalary ?? 0}`,
        ];
    }
  })() : [];

  return (
    <div className={`flex ${containerClasses[position]} pointer-events-auto transition-all`}>
      <div className={`flex items-center gap-4 ${position === 'left' || position === 'right' ? 'flex-col text-center' : ''}`}>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-2xl rotate-3 border-2 ${
          player.class === 'Worker' ? 'bg-blue-600 border-blue-400' : 
          player.class === 'Businessman' ? 'bg-amber-600 border-amber-400' : 
          player.class === 'Banker' ? 'bg-emerald-600 border-emerald-400' : 
          'bg-violet-600 border-violet-400'
        }`}>
          {player.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex flex-col">
          <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{player.class}</div>
          <div className="text-base font-black text-white leading-tight">{player.name} {isMe && "(YOU)"}</div>
        </div>
      </div>

      <div className={`flex gap-6 ${position === 'left' || position === 'right' ? 'flex-col mt-6' : 'items-center'}`}>
        <div className="flex flex-col items-center">
          <span className="text-[8px] font-black text-slate-500 uppercase">Capital</span>
          <span className="text-xl font-black text-emerald-400 flex items-center gap-1">
            <Coins className="w-4 h-4"/>${player.balance}
          </span>
        </div>

        {salaryInfo && (
          <div className="flex flex-col items-center group relative">
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-black text-slate-500 uppercase">Expected Income</span>
              <div className="relative">
                <Info className="w-3 h-3 text-slate-500 hover:text-white transition-colors" />
                <div className="pointer-events-none absolute left-1/2 bottom-full z-50 hidden w-64 -translate-x-1/2 pb-3 group-hover:block">
                  <div className="rounded-2xl border border-slate-700 bg-slate-950/95 p-4 text-left shadow-2xl">
                    <p className="mb-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">Income Sources</p>
                    <div className="space-y-1">
                      {salarySourceDetails.map((line) => (
                        <p key={line} className="text-[10px] font-bold leading-snug text-slate-300">{line}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <span className="text-xl font-black flex items-center gap-1">
              <span className="text-amber-500">${salaryInfo.finalSalary}</span>
            </span>
          </div>
        )}
        
        {(player.class === 'Politician' || player.class === 'Worker') && (
          <div className="flex flex-col items-center">
            <span className="text-[8px] font-black text-slate-500 uppercase">Popularity Points</span>
            <span className="text-xl font-black text-violet-400 flex items-center gap-1">
              {player.popularity}/10
            </span>
          </div>
        )}

        {player.is_waiting_at_go && (
          <div className="bg-emerald-500/20 border border-emerald-500/50 px-3 py-1 rounded-full animate-pulse">
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter">At GO</span>
          </div>
        )}

        {isMe && onLeave && (
          <button 
            onClick={onLeave}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/50 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest"
          >
            <LogOut className="w-3.5 h-3.5" />
            Leave Session
          </button>
        )}
      </div>
    </div>
  );
}

function PlayerLeaderboard({ game, players, me }: { game: GameState | null, players: Player[], me: Player | null }) {
  return (
    <div className="absolute top-4 right-4 z-30 flex flex-col gap-3 w-64">
      <div className="bg-slate-900/90 backdrop-blur-xl border-2 border-slate-800 rounded-3xl p-4 shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center mb-4 px-1">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Global District</span>
          <div className="flex items-center gap-1.5">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-black text-emerald-500 uppercase">{players.length} Active</span>
          </div>
        </div>
        
        <div className="space-y-2">
          {(() => {
            const currentIndex = players.findIndex(p => p.id === game?.current_player_id);
            const turnOrderedPlayers = currentIndex === -1 ? players : [
              ...players.slice(currentIndex),
              ...players.slice(0, currentIndex)
            ];

            return turnOrderedPlayers.map((p) => {
              const isMe = p.id === me?.id;
              const isCurrent = p.id === game?.current_player_id;
              return (
                <div key={p.id} className={`flex items-center gap-3 p-2 rounded-2xl transition-all ${isMe ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-slate-800/40 border border-slate-700/30'} ${isCurrent ? 'ring-2 ring-amber-500/50' : ''}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm text-white shadow-lg ${
                    p.class === 'Worker' ? 'bg-blue-600' :
                    p.class === 'Businessman' ? 'bg-amber-600' :
                    p.class === 'Banker' ? 'bg-emerald-600' :
                    'bg-violet-600'
                  }`}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] font-black text-white truncate leading-none">
                        {p.name} {isMe && "(YOU)"}
                        {isCurrent && <span className="ml-2 text-[9px] text-amber-500 animate-pulse font-black">TURN</span>}
                      </p>
                      <span className="text-[11px] font-black text-emerald-400 leading-none">${p.balance}</span>
                    </div>

                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">{p.class}</span>
                        <div className="flex items-center gap-2">
                          {(p.class === 'Politician' || p.class === 'Worker') && (
                            <span className="text-[8px] font-black text-violet-400 uppercase">POP: {p.popularity}</span>
                          )}
                          <div className={`w-1.5 h-1.5 rounded-full ${p.has_acted_this_year ? 'bg-slate-700' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`} title={p.has_acted_this_year ? "Ability Used" : "Ability Ready"} />
                        </div>
                      </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>      </div>
    </div>
  );
}

function Lobby({ gameId, players, me, onStart, onLeave }: { gameId: string, players: Player[], me: Player | null, onStart: () => void, onLeave: () => void }) {
  const isHost = players.length > 0 && me?.id === players[0].id;
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(gameId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-slate-900 border-4 border-slate-800 rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="bg-emerald-600 p-10 text-center relative">
          <button 
            onClick={onLeave}
            className="absolute top-6 right-6 p-3 bg-black/20 hover:bg-black/40 text-emerald-100 rounded-2xl transition-all"
            title="Leave Lobby"
          >
            <LogOut className="w-5 h-5" />
          </button>
          <span className="text-[12px] font-black text-emerald-100 uppercase tracking-[0.4em] mb-4 block">Game Lobby</span>
          <h1 className="text-5xl font-[1000] text-white tracking-tighter mb-6">READY UP</h1>
          <div 
            onClick={copyToClipboard}
            className="inline-flex items-center gap-3 bg-black/20 hover:bg-black/30 transition-colors px-6 py-3 rounded-2xl cursor-pointer group"
          >
            <span className="font-mono text-emerald-100 font-bold tracking-wider">{gameId}</span>
            {copied ? <CheckCircle2 className="w-5 h-5 text-emerald-300" /> : <Copy className="w-5 h-5 text-emerald-300 group-hover:scale-110 transition-transform" />}
          </div>
        </div>

        <div className="p-10 space-y-10">
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">Joined Players</h2>
              <span className="text-xs font-bold text-slate-600">{players.length}/4</span>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {players.map((p, idx) => (
                <div key={p.id} className="bg-slate-800/50 border-2 border-slate-700/50 p-5 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl text-white shadow-xl rotate-2
                      ${p.class === 'Worker' ? 'bg-blue-600' : 
                        p.class === 'Businessman' ? 'bg-amber-600' : 
                        p.class === 'Banker' ? 'bg-emerald-600' : 
                        'bg-violet-600'}
                    `}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-black text-white text-lg">{p.name} {p.id === me?.id && "(YOU)"}</p>
                        {idx === 0 && <span className="text-[8px] bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded font-black uppercase">Host</span>}
                      </div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{p.class}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-500 uppercase">Ready</span>
                  </div>
                </div>
              ))}
              {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
                <div key={i} className="border-2 border-dashed border-slate-800 p-5 rounded-2xl flex items-center justify-center">
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em]">Waiting for player...</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {isHost ? (
              <button
                onClick={onStart}
                disabled={players.length < 1}
                className="w-full py-6 bg-white text-slate-950 rounded-2xl font-[1000] text-2xl tracking-tight shadow-[0_8px_0_rgb(203,213,225)] hover:bg-slate-100 transition-all active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                START FISCAL CYCLE
              </button>
            ) : (
              <div className="bg-slate-800/30 border-2 border-slate-700/30 p-6 rounded-2xl text-center">
                <div className="flex items-center justify-center gap-3 mb-2">
                   <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                   <p className="font-black text-slate-400 uppercase text-sm tracking-widest">Waiting for Host</p>
                </div>
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">The game will begin shortly</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [gameIdInput, setGameIdInput] = useState<string>('');
  const [activeGameId, setActiveGameId] = useState<string>(() => localStorage.getItem('eco_game_id') || '');
  const [username, setUsername] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<PlayerClass | ''>('');
  const [isJoining, setIsJoining] = useState(false);
  const [copied, setCopied] = useState(false);

  const { game, me, players = [], setMe, startGame } = useGameStore();

  useEffect(() => {
    const initAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        await supabase.auth.signInAnonymously();
      }
    };
    initAuth();
  }, []);

  // Persist session
  useEffect(() => {
    if (activeGameId) localStorage.setItem('eco_game_id', activeGameId);
    else localStorage.removeItem('eco_game_id');
  }, [activeGameId]);

  useEffect(() => {
    if (me) localStorage.setItem('eco_me', JSON.stringify(me));
  }, [me]);

  // Recovery effect
  useEffect(() => {
    const savedMe = localStorage.getItem('eco_me');
    if (savedMe && !me) {
      setMe(JSON.parse(savedMe));
    }
  }, [setMe, me]);

  useGameSync(activeGameId);

  const handleHost = async () => {
    const newGame = await gameService.createGame();
    if (newGame) {
      setActiveGameId(newGame.id);
      setIsJoining(true);
    }
  };

  const handleJoinStart = () => {
    if (gameIdInput) {
      setActiveGameId(gameIdInput);
      setIsJoining(true);
    }
  };

  const handleFinalizeJoin = async () => {
    if (activeGameId && username && selectedClass) {
      const player = await gameService.joinGame(activeGameId, username, selectedClass as PlayerClass);
      if (player) {
        setMe(player);
        setIsJoining(false);
      }
    }
  };

  const handleLeave = () => {
    localStorage.removeItem('eco_game_id');
    localStorage.removeItem('eco_me');
    useGameStore.getState().reset();
    setActiveGameId('');
    setUsername('');
    setSelectedClass('');
    setIsJoining(false);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(activeGameId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // 1. Loading State
  if (activeGameId && !game && isJoining) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin shadow-[0_0_30px_rgba(59,130,246,0.4)]" />
          <p className="text-blue-500 font-black uppercase tracking-[0.4em] animate-pulse">Initializing District...</p>
        </div>
      </div>
    );
  }

  // 2. Join Form
  if (activeGameId && game && !me && isJoining) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-xl bg-slate-900 border-4 border-slate-800 rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] p-12">
          <div className="text-center mb-12">
             <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mb-4 block">Registration</span>
             <h1 className="text-5xl font-[1000] text-white tracking-tighter">JOIN GAME</h1>
          </div>
          
          <div className="space-y-8">
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Username</label>
              <input
                type="text"
                placeholder="Enter your name..."
                className="w-full p-5 bg-slate-950 border-2 border-slate-800 rounded-2xl text-white font-bold placeholder:text-slate-700 focus:border-blue-500 transition-colors outline-none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-4">Choose Your Class</label>
              <div className="grid grid-cols-2 gap-4">
                {(['Worker', 'Businessman', 'Banker', 'Politician'] as PlayerClass[]).map((cls) => {
                  const isTaken = players.some(p => p.class === cls);
                  const info = CLASS_INFO[cls];
                  
                  return (
                    <div key={cls} className="relative group">
                      <button
                        disabled={isTaken}
                        onClick={() => setSelectedClass(cls)}
                        className={`w-full p-5 rounded-2xl border-2 text-left transition-all ${
                          selectedClass === cls 
                            ? 'bg-blue-600/20 border-blue-500 ring-4 ring-blue-500/20' 
                            : isTaken
                              ? 'bg-slate-900 border-slate-800 opacity-40 cursor-not-allowed'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-black text-white uppercase text-[10px] tracking-widest">{cls}</div>
                          <div className="text-2xl leading-none">{info.icon}</div>
                        </div>
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{info.tag}</div>
                        {isTaken && (
                          <div className="mt-2 text-[8px] font-black text-rose-500 uppercase tracking-widest bg-rose-500/10 py-1 px-2 rounded border border-rose-500/20 text-center">
                            TAKEN
                          </div>
                        )}
                      </button>

                      {/* Info Tooltip */}
                      {!isTaken && (
                        <div className="absolute invisible group-hover:visible z-50 w-64 p-5 bg-slate-800 border-2 border-slate-700 rounded-2xl shadow-2xl -top-2 left-full ml-5 pointer-events-none animate-in fade-in slide-in-from-left-2 duration-200">
                          <div className="flex items-center gap-2 mb-3">
                             <div className="p-2 bg-blue-500/20 rounded-lg"><Info className="w-3 h-3 text-blue-500" /></div>
                             <div className="font-black text-white text-[10px] uppercase tracking-widest">Class Intelligence</div>
                          </div>
                          <p className="text-[11px] text-slate-300 leading-relaxed font-medium mb-4">{info.desc}</p>
                          <div className="pt-4 border-t border-slate-700 flex justify-between items-center">
                             <span className="text-[9px] font-black text-blue-400 uppercase tracking-tighter">Strategic Objective</span>
                             <span className="text-sm">🏆</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleFinalizeJoin}
              disabled={!username || !selectedClass}
              className="w-full py-6 bg-blue-600 text-white rounded-2xl font-[1000] text-2xl tracking-tight shadow-[0_8px_0_rgb(30,64,175)] hover:bg-blue-500 transition-all active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              FINALIZE SELECTION
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Lobby (Wait for start)
  if (activeGameId && game && me && !game.started) {
    return <Lobby gameId={activeGameId} players={players} me={me} onStart={startGame} onLeave={handleLeave} />;
  }

  // 4. Main Game View
  if (activeGameId && game && me && game.started) {
    return (
      <div className="h-screen w-screen bg-slate-950 overflow-hidden flex flex-col select-none">
        <PlayerLeaderboard game={game} players={players} me={me} />

        <main className="flex-1 relative flex">
          <div className="flex-1 flex items-center justify-center p-8 bg-slate-950/50 backdrop-blur-3xl">
             <GameBoard />
          </div>
        </main>

        <div className="z-20 relative">
          <PlayerInventory player={me} game={game} isMe position="bottom" onLeave={handleLeave} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans overflow-hidden relative">
       {/* Background Grid Pattern */}
       <div className="absolute inset-0 opacity-10" style={{ 
         backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', 
         backgroundSize: '32px 32px' 
       }} />
       
       <div className="relative z-10 w-full max-w-4xl space-y-12">
        <div className="text-center space-y-6">
      
          <h1 className="text-[7rem] font-[1000] text-white leading-[0.8] tracking-tighter">
            MACRO<br/>
            <span className="text-blue-500">MAYHEM</span>
          </h1>
          <p className="text-slate-400 text-xl font-bold max-w-2xl mx-auto uppercase tracking-widest opacity-60">
            A Strategic Simulation of Economic Turmoil & Political Maneuvering
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Host Card */}
          <div className="bg-slate-900 border-4 border-slate-800 p-10 rounded-[3rem] space-y-8 hover:border-blue-500/50 transition-colors shadow-2xl group">
            <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center shadow-lg rotate-3 group-hover:rotate-6 transition-transform">
               <Plus className="w-8 h-8 text-white stroke-[3px]" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-[1000] text-white tracking-tight">CREATE OFFICE</h2>
              <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">Start a new economic simulation</p>
            </div>
            <button
              onClick={handleHost}
              className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xl shadow-[0_8px_0_rgb(30,64,175)] hover:bg-blue-500 transition-all active:translate-y-1 active:shadow-none"
            >
              HOST NEW SESSION
            </button>
          </div>

          {/* Join Card */} 
          <div className="bg-slate-900 border-4 border-slate-800 p-10 rounded-[3rem] space-y-8 hover:border-emerald-500/50 transition-colors shadow-2xl group">
            <div className="w-16 h-16 bg-emerald-600 rounded-3xl flex items-center justify-center shadow-lg -rotate-3 group-hover:-rotate-6 transition-transform">
               <Users className="w-8 h-8 text-white stroke-[3px]" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-[1000] text-white tracking-tight">ENTER DISTRICT</h2>
              <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">Join an existing simulation code</p>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Enter Session ID..."
                className="w-full p-5 bg-slate-950 border-2 border-slate-800 rounded-2xl text-white font-mono font-bold placeholder:text-slate-800 focus:border-emerald-500 outline-none transition-colors"
                value={gameIdInput}
                onChange={(e) => setGameIdInput(e.target.value)}
              />
              <button
                onClick={handleJoinStart}
                className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-xl shadow-[0_8px_0_rgb(5,150,105)] hover:bg-emerald-500 transition-all active:translate-y-1 active:shadow-none"
              >
                JOIN SESSION
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-12 pt-8">
           <div className="flex flex-col items-center">
             <span className="text-[10px] font-black text-slate-700 uppercase mb-2">Developed By</span>
             <span className="font-black text-slate-500 tracking-widest">MACROSOFT LABS</span>
           </div>
        </div>
      </div>
    </div>
  );
}

export default App;
