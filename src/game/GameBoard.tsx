import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { useGameStore } from '../hooks/useGameStore';
import { SquareType, Player } from '../types/game';
import { supabase } from '../services/supabase';

const SQUARES_PER_SIDE = 6; 
const TOTAL_SQUARES = 24;
const TILE_SIZE = 100;
const BOARD_SIZE_TILES = 7;
const BOARD_PX = TILE_SIZE * BOARD_SIZE_TILES;

interface BoardSquareData {
  type: SquareType;
  label: string;
  subLabel: string;
}

const BOARD_LAYOUT: BoardSquareData[] = [
  { type: 'GO', label: 'GO', subLabel: 'Start/Finish' },
  { type: 'POLICY_VOTE', label: 'Policy Vote', subLabel: 'Cast Your Ballot' },
  { type: 'VACATION', label: 'Vacation', subLabel: 'Relax & Recovery' },
  { type: 'PAY_EXPENSES', label: 'Pay Expenses', subLabel: 'Bills Due' },
  { type: 'CHANCE', label: 'Random Chance', subLabel: 'Market News' },
  { type: 'POLICY_VOTE', label: 'Policy Vote', subLabel: 'Cast Your Ballot' },
  { type: 'VACATION', label: 'Vacation', subLabel: 'Relax & Recovery' },
  { type: 'PAY_EXPENSES', label: 'Pay Expenses', subLabel: 'Bills Due' },
  { type: 'CHANCE', label: 'Random Chance', subLabel: 'Market News' },
  { type: 'POLICY_VOTE', label: 'Policy Vote', subLabel: 'Cast Your Ballot' },
  { type: 'VACATION', label: 'Vacation', subLabel: 'Relax & Recovery' },
  { type: 'PAY_EXPENSES', label: 'Pay Expenses', subLabel: 'Bills Due' },
  { type: 'CHANCE', label: 'Random Chance', subLabel: 'Market News' },
  { type: 'POLICY_VOTE', label: 'Policy Vote', subLabel: 'Cast Your Ballot' },
  { type: 'VACATION', label: 'Vacation', subLabel: 'Relax & Recovery' },
  { type: 'PAY_EXPENSES', label: 'Pay Expenses', subLabel: 'Bills Due' },
  { type: 'CHANCE', label: 'Random Chance', subLabel: 'Market News' },
  { type: 'POLICY_VOTE', label: 'Policy Vote', subLabel: 'Cast Your Ballot' },
  { type: 'VACATION', label: 'Vacation', subLabel: 'Relax & Recovery' },
  { type: 'PAY_EXPENSES', label: 'Pay Expenses', subLabel: 'Bills Due' },
  { type: 'CHANCE', label: 'Random Chance', subLabel: 'Market News' },
  { type: 'POLICY_VOTE', label: 'Policy Vote', subLabel: 'Cast Your Ballot' },
  { type: 'VACATION', label: 'Vacation', subLabel: 'Relax & Recovery' },
  { type: 'PAY_EXPENSES', label: 'Pay Expenses', subLabel: 'Bills Due' },
];

const COLORS: Record<SquareType, number> = {
  GO: 0x10b981,
  POLICY_VOTE: 0x3b82f6,
  VACATION: 0x8b5cf6,
  PAY_EXPENSES: 0xef4444,
  CHANCE: 0xeab308,
};

const ABILITIES = {
  Worker: { name: 'Strike', cost: '$3', effect: 'Unemployment +1, GDP -1' },
  Businessman: { name: 'Invest', cost: '$3', effect: 'GDP +1' },
  Banker: { name: 'Adjust Rates', cost: '$4', effect: 'Inflation ±1' },
  Politician: { name: 'Order', cost: '3 Pop', effect: 'Unemployment -1' },
};

const getSquarePosition = (i: number) => {
  let tx = 0, ty = 0;
  if (i < 6) { tx = i; ty = 0; }
  else if (i < 12) { tx = 6; ty = i - 6; }
  else if (i < 18) { tx = 6 - (i - 12); ty = 6; }
  else { tx = 0; ty = 6 - (i - 18); }
  return { x: tx * TILE_SIZE, y: ty * TILE_SIZE };
};

export const GameBoard: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const boardContainerRef = useRef<PIXI.Container | null>(null);
  const diceContainerRef = useRef<PIXI.Container | null>(null);
  const playerTokens = useRef<Map<string, PIXI.Graphics>>(new Map());
  const visualPositions = useRef<Map<string, number>>(new Map());
  const lastResolvedPos = useRef<number>(-1);

  const { 
    game, players, me, 
    rollDice, endTurn, useAbility, 
    resolveSquare, submitBid, resolvePolicyVote, 
    getWinners, clearActionMessage 
  } = useGameStore();

  const [isRolling, setIsRolling] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [showAbilityInfo, setShowAbilityInfo] = useState(false);
  const [activePolicy, setActivePolicy] = useState<any>(null);
  const [bidVote, setBidVote] = useState<'YES' | 'NO'>('YES');
  const [bidAmount, setBidAmount] = useState(0);
  const [hasBid, setHasBid] = useState(false);
  const [bidsCount, setBidsCount] = useState(0);
  const [winners, setWinners] = useState<Player[]>([]);
  const [bankerChoice, setBankerChoice] = useState<boolean>(false);
  const [isPixiReady, setIsPixiReady] = useState(false);

  const handleRoll = useCallback(async () => {
    if (isRolling || isMoving) return;
    setIsRolling(true);
    await new Promise(r => setTimeout(r, 800));
    await rollDice();
    setIsRolling(false);
  }, [rollDice, isRolling, isMoving]);

  const handleAbilityClick = useCallback(async () => {
    if (me?.class === 'Banker') {
      setBankerChoice(true);
      return;
    }
    setIsActing(true);
    try {
      await useAbility();
    } finally {
      setIsActing(false);
    }
  }, [me?.class, useAbility]);

  const handleBankerAction = useCallback(async (dir: 'up' | 'down') => {
    setIsActing(true);
    try {
      await useAbility(dir);
    } finally {
      setIsActing(false);
      setBankerChoice(false);
    }
  }, [useAbility]);

  const handleSubmitBid = useCallback(async () => {
    await submitBid(bidVote, bidAmount);
    setHasBid(true);
  }, [submitBid, bidVote, bidAmount]);

  const handleResolveVote = useCallback(async () => {
    await resolvePolicyVote();
  }, [resolvePolicyVote]);

  const handleClearMessage = useCallback(() => {
    clearActionMessage();
  }, [clearActionMessage]);

  useEffect(() => {
    const fetchPolicy = async () => {
      if (game?.current_policy_id) {
        const { data: policy } = await supabase.from('policy_cards').select('*').eq('id', game.current_policy_id).single();
        setActivePolicy(policy);
        setHasBid(false);
        setBidAmount(0);
      } else {
        setActivePolicy(null);
      }
    };
    fetchPolicy();
  }, [game?.current_policy_id]);

  useEffect(() => {
    if (game?.voting_active && game?.id) {
      const fetchBids = async () => {
        const { count } = await supabase.from('policy_bids').select('*', { count: 'exact', head: true }).eq('game_id', game.id);
        setBidsCount(count || 0);
        if (me) {
          const { data } = await supabase.from('policy_bids').select('id').eq('game_id', game.id).eq('player_id', me.id).maybeSingle();
          if (data) setHasBid(true);
        }
      };
      fetchBids();
      const channel = supabase.channel(`bids-${game.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'policy_bids', filter: `game_id=eq.${game.id}` }, fetchBids).subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [game?.voting_active, game?.id, me?.id]);

  useEffect(() => {
    if (game?.year && game.year > 10) {
      getWinners().then(setWinners);
    }
  }, [game?.year, getWinners]);

  useEffect(() => {
    if (game?.current_player_id === me?.id && game?.has_rolled && me && !isMoving && me.position !== lastResolvedPos.current) {
      const timer = setTimeout(() => {
        const square = BOARD_LAYOUT[me.position];
        resolveSquare(square.type);
        lastResolvedPos.current = me.position;
      }, 400);
      return () => clearTimeout(timer);
    }
    if (!game?.has_rolled || game?.current_player_id !== me?.id) {
      lastResolvedPos.current = -1;
    }
  }, [game?.has_rolled, game?.current_player_id, me?.position, me?.id, resolveSquare, isMoving]);

  // PIXI INIT
  useEffect(() => {
    let app: PIXI.Application | null = null;
    let isDestroyed = false;

    const initPixi = async () => {
      app = new PIXI.Application();
      await app.init({
        width: BOARD_PX, height: BOARD_PX,
        backgroundColor: 0x0f172a, antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true, roundPixels: false,
      });

      if (isDestroyed) { app.destroy(true, { children: true, texture: true }); return; }
      if (containerRef.current) containerRef.current.appendChild(app.canvas);

      const boardContainer = new PIXI.Container();
      app.stage.addChild(boardContainer);
      boardContainerRef.current = boardContainer;
      appRef.current = app;

      const diceContainer = new PIXI.Container();
      diceContainer.x = BOARD_PX / 2; diceContainer.y = BOARD_PX / 2;
      app.stage.addChild(diceContainer);
      diceContainerRef.current = diceContainer;

      for (let i = 0; i < TOTAL_SQUARES; i++) {
        const data = BOARD_LAYOUT[i];
        const color = COLORS[data.type];
        const pos = getSquarePosition(i);
        const square = new PIXI.Container();
        square.x = pos.x; square.y = pos.y;
        boardContainer.addChild(square);

        const bg = new PIXI.Graphics();
        bg.roundRect(0, 0, TILE_SIZE, TILE_SIZE, 8);
        bg.fill({ color: 0x1e293b, alpha: 0.9 });
        bg.setStrokeStyle({ width: 3, color: 0x334155 });
        bg.stroke();
        square.addChild(bg);

        const header = new PIXI.Graphics();
        header.rect(0, 0, TILE_SIZE, 12); header.fill(color);
        square.addChild(header);

        const label = new PIXI.Text({
          text: data.label.toUpperCase(),
          style: { fontSize: 11, fill: 0xffffff, align: 'center', fontWeight: '900', letterSpacing: 1, wordWrap: true, wordWrapWidth: TILE_SIZE - 10 }
        });
        label.anchor.set(0.5, 0); label.x = TILE_SIZE / 2; label.y = 24;
        square.addChild(label);

        const sub = new PIXI.Text({
          text: data.subLabel,
          style: { fontSize: 8, fill: 0x64748b, align: 'center', fontWeight: 'bold', wordWrap: true, wordWrapWidth: TILE_SIZE - 10 }
        });
        sub.anchor.set(0.5, 0); sub.x = TILE_SIZE / 2; sub.y = 65;
        square.addChild(sub);
      }
      setIsPixiReady(true);
    };

    initPixi();

    return () => {
      isDestroyed = true; setIsPixiReady(false);
      if (app) {
        try {
          if (app.renderer && app.canvas && app.canvas.parentNode) app.canvas.parentNode.removeChild(app.canvas);
          app.destroy(true, { children: true, texture: true });
        } catch (e) { console.warn('PixiJS cleanup warning:', e); }
        appRef.current = null; boardContainerRef.current = null; diceContainerRef.current = null;
      }
    };
  }, []);

  // TICKER: DICE (Simple & Snappy)
  useEffect(() => {
    if (!diceContainerRef.current || !appRef.current) return;
    const container = diceContainerRef.current;
    const app = appRef.current;
    
    let cycleFrame = 0;
    const diceTicker = (delta: PIXI.Ticker) => {
      if (isRolling) {
        cycleFrame += delta.deltaTime;
        // Cycle number every 2 frames for a smooth blur feel
        if (cycleFrame >= 2) {
          cycleFrame = 0;
          container.removeChildren();
          
          const diceBg = new PIXI.Graphics();
          diceBg.roundRect(-45, -45, 90, 90, 16);
          diceBg.fill(0xffffff);
          diceBg.setStrokeStyle({ width: 4, color: 0x334155 });
          diceBg.stroke();
          container.addChild(diceBg);

          const randomNum = Math.floor(Math.random() * 6) + 1;
          const diceText = new PIXI.Text({
            text: randomNum.toString(),
            style: { fontSize: 56, fill: 0x0f172a, fontWeight: '900' }
          });
          diceText.anchor.set(0.5);
          container.addChild(diceText);
          
          // Simple rotation jitter
          container.rotation = (Math.random() - 0.5) * 0.1;
          // Simple scale pulse
          container.scale.set(1 + Math.sin(app.ticker.lastTime * 0.02) * 0.1);
        }
      } else if (game?.last_roll) {
        // Impact reveal logic
        if (container.children.length === 0 || (container.children[1] as PIXI.Text)?.text !== game.last_roll.toString()) {
           container.removeChildren();
           container.rotation = 0;
           
           const diceBg = new PIXI.Graphics();
           diceBg.roundRect(-45, -45, 90, 90, 16);
           diceBg.fill(0xffffff);
           diceBg.setStrokeStyle({ width: 6, color: 0x10b981 }); // Green for success
           diceBg.stroke();
           container.addChild(diceBg);

           const diceText = new PIXI.Text({
             text: game.last_roll.toString(),
             style: { fontSize: 56, fill: 0x0f172a, fontWeight: '900' }
           });
           diceText.anchor.set(0.5);
           container.addChild(diceText);
           
           // Start the "Pop" scale
           container.scale.set(1.5);
        }
        // Smoothly settle the "Pop" back to normal size
        const settleSpeed = 0.15 * delta.deltaTime;
        container.scale.set(container.scale.x + (1 - container.scale.x) * Math.min(1, settleSpeed));
      } else {
        container.removeChildren();
      }
    };
    app.ticker.add(diceTicker);
    return () => { app.ticker.remove(diceTicker); };
  }, [isRolling, game?.last_roll]);

  // TICKER: MOVEMENT
  useEffect(() => {
    if (!appRef.current || !isPixiReady) return;
    const app = appRef.current;

    const moveTicker = (delta: PIXI.Ticker) => {
      let activeMoves = false;
      players.forEach((player, idx) => {
        const token = playerTokens.current.get(player.id);
        if (!token) return;

        let currentVisPos = visualPositions.current.get(player.id) ?? player.position;
        const logicalPos = player.position;

        if (currentVisPos !== logicalPos) {
          activeMoves = true;
          const nextStep = (currentVisPos + 1) % TOTAL_SQUARES;
          const targetPos = getSquarePosition(nextStep);
          const offset = (idx % 4) * 14 - 20;
          const targetX = targetPos.x + TILE_SIZE / 2 + offset;
          const targetY = targetPos.y + TILE_SIZE / 2 + offset;

          const dx = targetX - token.x;
          const dy = targetY - token.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 1.5) {
            visualPositions.current.set(player.id, nextStep);
            token.x = targetX; token.y = targetY;
          } else {
            const lerpFactor = 0.25 * delta.deltaTime;
            token.x += dx * Math.min(1, lerpFactor);
            token.y += dy * Math.min(1, lerpFactor);
            const progress = 1 - (dist / TILE_SIZE);
            const hop = Math.sin(progress * Math.PI) * 30;
            token.scale.set(1 + (hop / 100));
          }
        } else {
          const idleOffset = (idx % 4) * 14 - 20;
          const basePos = getSquarePosition(logicalPos);
          const targetX = basePos.x + TILE_SIZE / 2 + idleOffset;
          const targetY = basePos.y + TILE_SIZE / 2 + idleOffset;
          token.x += (targetX - token.x) * 0.1 * delta.deltaTime;
          token.y += (targetY - token.y) * 0.1 * delta.deltaTime;
          token.scale.set(token.scale.x + (1 - token.scale.x) * 0.1 * delta.deltaTime);
        }
      });
      if (activeMoves) setIsMoving(true);
      else if (!activeMoves && isMoving) {
        const stillActive = [...visualPositions.current.entries()].some(([id, pos]) => {
          const p = players.find(p => p.id === id);
          return p && p.position !== pos;
        });
        if (!stillActive) setIsMoving(false);
      }
    };
    app.ticker.add(moveTicker);
    return () => { app.ticker.remove(moveTicker); };
  }, [players, isPixiReady, isMoving]);

  useEffect(() => {
    const boardContainer = boardContainerRef.current;
    if (!boardContainer || !isPixiReady) return;
    players.forEach((player, idx) => {
      if (!playerTokens.current.has(player.id)) {
        const token = new PIXI.Graphics();
        const colors = { Worker: 0x3b82f6, Businessman: 0xf59e0b, Banker: 0x10b981, Politician: 0x8b5cf6 };
        token.circle(0, 0, 16); token.fill(colors[player.class as keyof typeof colors] || 0xffffff);
        token.setStrokeStyle({ width: 3, color: 0xffffff }); token.stroke();
        const pos = getSquarePosition(player.position);
        const offset = (idx % 4) * 14 - 20;
        token.x = pos.x + TILE_SIZE / 2 + offset; token.y = pos.y + TILE_SIZE / 2 + offset;
        boardContainer.addChild(token);
        playerTokens.current.set(player.id, token);
        visualPositions.current.set(player.id, player.position);
      }
    });
  }, [players, isPixiReady]);

  const currentPlayerIndex = game?.current_player_id ? players.findIndex(p => p.id === game.current_player_id) : -1;
  const currentPlayer = currentPlayerIndex !== -1 ? players[currentPlayerIndex] : null;
  const nextPlayer = players.length > 0 && currentPlayerIndex !== -1 ? players[(currentPlayerIndex + 1) % players.length] : null;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-950 p-8">
      <div className="fixed bottom-32 right-8 z-[120] flex flex-col gap-4 pointer-events-none">
        {game?.last_action_message && (
          <div className="bg-amber-500 text-slate-950 px-8 py-5 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.4)] border-4 border-white animate-in slide-in-from-right-20 fade-in duration-500 flex items-center gap-5 max-w-md pointer-events-auto group translate-z-0">
             <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-xl shrink-0 rotate-3 group-hover:rotate-12 transition-transform duration-300">⚡</div>
             <div className="flex-1 min-w-0">
               <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 block mb-1">Global Bulletin</span>
               <p className="text-xl font-black leading-tight tracking-tight">{game.last_action_message}</p>
             </div>
             <button onClick={handleClearMessage} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-950/10 hover:bg-slate-950/20 transition-all active:scale-90"><span className="font-black text-2xl leading-none">×</span></button>
          </div>
        )}
      </div>

      {game?.year && game.year > 10 && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center z-[100] p-4 animate-in fade-in duration-700">
          <div className="bg-slate-900 border-4 border-slate-800 w-full max-w-2xl rounded-[3rem] shadow-[0_0_150px_rgba(0,0,0,0.8)] p-12 text-center space-y-8">
            <div><span className="text-[12px] font-black text-emerald-500 uppercase tracking-[0.4em] mb-4 block">Fiscal Decade Concluded</span><h1 className="text-6xl font-[1000] text-white tracking-tighter">GAME OVER</h1></div>
            <div className="space-y-4">
              <h2 className="text-xl font-black text-slate-400 uppercase tracking-widest">The Victors</h2>
              {winners.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">{winners.map(w => (
                  <div key={w.id} className="bg-emerald-500/10 border-2 border-emerald-500/50 p-6 rounded-3xl flex justify-between items-center">
                    <div className="text-left"><p className="text-2xl font-black text-white">{w.name}</p><p className="text-sm font-bold text-emerald-400 uppercase tracking-widest">{w.class}</p></div>
                    <div className="bg-emerald-500 text-slate-950 px-6 py-2 rounded-2xl font-black text-lg">WINNER</div>
                  </div>
                ))}</div>
              ) : (
                <div className="bg-rose-500/10 border-2 border-rose-500/50 p-12 rounded-3xl"><p className="text-2xl font-black text-rose-500 uppercase">Systemic Collapse</p><p className="text-slate-400 font-bold mt-2">No one met their win conditions.</p></div>
              )}
            </div>
            <button onClick={() => window.location.reload()} className="px-12 py-5 bg-white text-slate-950 rounded-2xl font-black text-xl hover:bg-slate-200 transition-all shadow-[0_8px_0_rgb(203,213,225)] active:translate-y-1 active:shadow-none">MAIN MENU</button>
          </div>
        </div>
      )}

      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex gap-6 bg-slate-900/90 backdrop-blur-xl border-2 border-slate-700 p-6 rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] z-20">
        <div className="flex flex-col items-center gap-2"><span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">GDP Growth</span><div className="flex gap-1.5">{[1, 2, 3, 4, 5].map(lvl => (<div key={lvl} className={`w-8 h-3 rounded-full transition-all duration-500 ${lvl <= (game?.gdp || 3) ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)] scale-y-110' : 'bg-slate-800 opacity-30'}`} />))}</div></div>
        <div className="w-px h-12 bg-slate-700 self-center" />
        <div className="flex flex-col items-center gap-2"><span className="text-[10px] font-black text-violet-500 uppercase tracking-widest">Inflation</span><div className="flex gap-1.5">{[1, 2, 3, 4, 5].map(lvl => (<div key={lvl} className={`w-8 h-3 rounded-full transition-all duration-500 ${lvl <= (game?.inflation || 3) ? 'bg-violet-500 shadow-[0_0_20px_rgba(124,58,237,0.5)] scale-y-110' : 'bg-slate-800 opacity-30'}`} />))}</div></div>
        <div className="w-px h-12 bg-slate-700 self-center" />
        <div className="flex flex-col items-center gap-2"><span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Unemployment</span><div className="flex gap-1.5">{[1, 2, 3, 4, 5].map(lvl => (<div key={lvl} className={`w-8 h-3 rounded-full transition-all duration-500 ${lvl <= (game?.unemployment || 3) ? 'bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)] scale-y-110' : 'bg-slate-800 opacity-30'}`} />))}</div></div>
        <div className="w-px h-12 bg-slate-700 self-center" />
        <div className="flex flex-col items-center justify-center px-4"><span className="text-3xl font-[1000] text-white tracking-tighter">YEAR {game?.year || 1}</span><span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Cycle Active</span></div>
      </div>

      <div className="absolute top-8 left-8 ml-24 flex flex-col gap-4 bg-slate-900/90 backdrop-blur border-2 border-slate-700 p-5 rounded-[2rem] shadow-2xl z-10">
        <div className="flex items-center gap-6">
          <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Current Focus</span><div className="flex items-center gap-3"><div className={`w-4 h-4 rounded-full animate-ping ${currentPlayer?.class === 'Worker' ? 'bg-blue-500' : currentPlayer?.class === 'Businessman' ? 'bg-amber-500' : currentPlayer?.class === 'Banker' ? 'bg-emerald-500' : 'bg-violet-500'}`} /><span className="text-2xl font-[1000] text-white tracking-tight">{currentPlayer?.name || '...'}</span></div></div>
          <div className="h-12 w-px bg-slate-700" /><div className="flex flex-col opacity-50"><span className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Pending</span><span className="text-lg font-black text-slate-300">{nextPlayer?.name || '-'}</span></div>
        </div>
      </div>

      <div ref={containerRef} className="shadow-[0_0_120px_rgba(0,0,0,0.8)] rounded-[3rem] border-[12px] border-slate-800 overflow-hidden bg-slate-900 translate-z-0" />

      {game?.voting_active && activePolicy && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border-4 border-slate-800 w-full max-w-lg rounded-[3rem] shadow-[0_0_100px_rgba(59,130,246,0.2)] overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-blue-600 p-8 flex justify-between items-center"><div><span className="text-[10px] font-black text-blue-100 uppercase tracking-[0.3em]">Critical Policy Vote</span><h2 className="text-4xl font-[1000] text-white tracking-tighter">{activePolicy.name}</h2></div><div className="bg-white/20 px-5 py-3 rounded-[1.5rem]"><span className="text-base font-black text-white">{bidsCount}/{players.length} BIDS</span></div></div>
            <div className="p-10 space-y-8">
              <div className="bg-slate-800/80 rounded-[2rem] p-8 border-2 border-slate-700 shadow-inner"><h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 text-center">Projected Economic Outcomes</h3><div className="grid grid-cols-3 gap-6"><div className="flex flex-col items-center"><span className="text-2xl font-black text-emerald-400">{activePolicy.gdp_mod > 0 ? '+' : ''}{activePolicy.gdp_mod}</span><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">GDP</span></div><div className="flex flex-col items-center border-x-2 border-slate-700"><span className="text-2xl font-black text-violet-400">{activePolicy.inflation_mod > 0 ? '+' : ''}{activePolicy.inflation_mod}</span><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">INF</span></div><div className="flex flex-col items-center"><span className="text-2xl font-black text-rose-400">{activePolicy.unemployment_mod > 0 ? '+' : ''}{activePolicy.unemployment_mod}</span><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">UNP</span></div></div></div>
              {!hasBid ? (
                <div className="space-y-8">
                  <div className="flex gap-4"><button onClick={() => setBidVote('YES')} className={`flex-1 py-5 rounded-2xl font-black text-2xl border-4 transition-all ${bidVote === 'YES' ? 'bg-emerald-600 border-emerald-400 text-white shadow-xl' : 'bg-slate-800 border-slate-700 text-slate-600'}`}>YES</button><button onClick={() => setBidVote('NO')} className={`flex-1 py-5 rounded-2xl font-black text-2xl border-4 transition-all ${bidVote === 'NO' ? 'bg-rose-600 border-rose-400 text-white shadow-xl' : 'bg-slate-800 border-slate-700 text-slate-600'}`}>NO</button></div>
                  <div className="space-y-4"><div className="flex justify-between text-xs font-black text-slate-500 uppercase tracking-widest px-1"><span>Allocate Capital</span><span className="text-emerald-500">Available: ${me?.balance}</span></div><div className="flex items-center gap-6"><input type="range" min="0" max={me?.balance || 0} step="1" value={bidAmount} onChange={(e) => setBidAmount(parseInt(e.target.value))} className="flex-1 h-4 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" /><span className="bg-slate-950 px-6 py-3 rounded-2xl font-black text-2xl text-white border-2 border-slate-800">${bidAmount}</span></div></div>
                  <button onClick={handleSubmitBid} className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-[2rem] font-black text-2xl shadow-[0_10px_0_rgb(30,64,175)] active:translate-y-1 transition-all">SUBMIT FINAL BID</button>
                </div>
              ) : (
                <div className="flex flex-col items-center py-12 space-y-6"><div className="w-20 h-20 border-8 border-blue-500 border-t-transparent rounded-full animate-spin shadow-2xl" /><p className="text-2xl font-[1000] text-white tracking-tight">ENCRYPTING VOTE</p><p className="text-slate-500 font-bold uppercase tracking-widest">Awaiting result reveal...</p>{game.current_player_id === me?.id && bidsCount === players.length && (<button onClick={handleResolveVote} className="mt-8 px-12 py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[2rem] font-black text-2xl shadow-[0_8px_0_rgb(5,150,105)] animate-bounce">PROCEED</button>)}</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-12 flex items-center justify-center gap-6 w-full z-10">
        <div className="flex items-center gap-6 bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[2.5rem] border-2 border-slate-700/50 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
          <div className="relative flex items-center">
            {me?.class === 'Banker' && !me.has_acted_this_year && !game?.has_rolled && game?.current_player_id === me.id && bankerChoice ? (
              <div className="flex gap-3 bg-slate-800 p-3 rounded-2xl border-2 border-slate-700 shadow-2xl animate-in zoom-in-90">
                 <button onClick={() => handleBankerAction('up')} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black hover:bg-emerald-500 text-lg">↑ UP</button>
                 <button onClick={() => handleBankerAction('down')} className="px-6 py-3 bg-rose-600 text-white rounded-xl font-black hover:bg-rose-500 text-lg">↓ DOWN</button>
                 <button onClick={() => setBankerChoice(false)} className="px-6 py-3 bg-slate-700 text-slate-400 rounded-xl font-black text-lg">✕</button>
              </div>
            ) : (
              <button onClick={handleAbilityClick} disabled={game?.current_player_id !== me?.id || game?.has_rolled || me?.has_acted_this_year || isActing || isMoving} className={`px-8 py-5 rounded-[1.5rem] font-black text-xl transition-all duration-300 flex items-center gap-3 ${(game?.current_player_id === me?.id && !game?.has_rolled && !me?.has_acted_this_year) ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-[0_6px_0_rgb(180,83,9)] active:translate-y-1 active:shadow-none' : 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-40'}`}>{isActing ? 'EXECUTING...' : me?.class && ABILITIES[me.class as keyof typeof ABILITIES].name.toUpperCase()}{me?.has_acted_this_year && <span className="text-[10px] bg-slate-700 px-2 py-1 rounded-lg uppercase text-slate-400">Locked</span>}</button>
            )}
            <button onMouseEnter={() => setShowAbilityInfo(true)} onMouseLeave={() => setShowAbilityInfo(false)} className="absolute -top-3 -right-3 w-8 h-8 bg-slate-700 text-slate-200 rounded-full text-sm font-black border-2 border-slate-600 hover:bg-slate-600 transition-colors shadow-lg">?</button>
            {showAbilityInfo && me?.class && (<div className="absolute bottom-full mb-6 left-1/2 -translate-x-1/2 w-64 bg-slate-800 border-2 border-slate-700 p-5 rounded-[2rem] shadow-2xl z-30 animate-in fade-in slide-in-from-bottom-2"><p className="font-black text-amber-400 mb-2 text-lg tracking-tight">{ABILITIES[me.class as keyof typeof ABILITIES].name}</p><div className="space-y-1"><p className="text-slate-300 text-xs"><span className="font-black text-white uppercase tracking-widest text-[9px]">Resource Cost:</span> {ABILITIES[me.class as keyof typeof ABILITIES].cost}</p><p className="text-slate-400 italic text-xs leading-relaxed">{ABILITIES[me.class as keyof typeof ABILITIES].effect}</p></div></div>)}
          </div>
          <div className="w-px h-14 bg-slate-700/50" /><button onClick={handleRoll} disabled={isRolling || game?.current_player_id !== me?.id || game?.has_rolled || me?.is_waiting_at_go || isMoving} className={`relative px-16 py-6 rounded-[2rem] font-[1000] text-3xl transition-all duration-300 tracking-tighter ${(game?.current_player_id === me?.id && !game?.has_rolled && !me?.is_waiting_at_go) ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_10px_0_rgb(5,150,105)] active:translate-y-1 active:shadow-none' : 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-40 shadow-none'}`}>{isRolling ? 'ROLLING...' : me?.is_waiting_at_go ? 'AT GO' : 'ROLL DICE'}</button>          <button onClick={endTurn} disabled={isRolling || game?.current_player_id !== me?.id || (!game?.has_rolled && !me?.is_waiting_at_go) || isMoving} className={`px-10 py-5 rounded-[1.5rem] font-black text-xl transition-all duration-300 tracking-tight ${(game?.current_player_id === me?.id && (game?.has_rolled || me?.is_waiting_at_go)) ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_6px_0_rgb(30,64,175)] active:translate-y-1 active:shadow-none' : 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-40 shadow-none'}`}>{me?.is_waiting_at_go && !game?.has_rolled ? 'STAY AT GO' : 'END TURN'}</button>
        </div>
      </div>
    </div>
  );
};
