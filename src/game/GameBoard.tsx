import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { useGameStore } from '../hooks/useGameStore';
import { SquareType, Player, PolicyTrade } from '../types/game';
import { supabase } from '../services/supabase';
import { gameService, CHEAP_EXPENSES, SPECIAL_EXPENSES } from '../services/gameService';
import { calculateSalary } from '../engine/economy';

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
  { type: 'GO', label: 'GO', subLabel: 'Collect Salary' }, // 0
  { type: 'POLICY_VOTE', label: 'Policy Vote', subLabel: 'Cast Your Ballot' },
  { type: 'VACATION', label: 'Vacation', subLabel: 'Relax & Recovery' },
  { type: 'PAY_EXPENSES', label: 'Pay Expenses', subLabel: 'Bills Due' },
  { type: 'CHANCE', label: 'Random Chance', subLabel: 'Market News' },
  { type: 'POLICY_VOTE', label: 'Policy Vote', subLabel: 'Cast Your Ballot' },
  { type: 'CHANCE', label: 'Random Chance', subLabel: 'Market News' }, // 6
  { type: 'PAY_EXPENSES', label: 'Pay Expenses', subLabel: 'Bills Due' },
  { type: 'CHANCE', label: 'Random Chance', subLabel: 'Market News' },
  { type: 'POLICY_VOTE', label: 'Policy Vote', subLabel: 'Cast Your Ballot' },
  { type: 'VACATION', label: 'Vacation', subLabel: 'Relax & Recovery' },
  { type: 'PAY_EXPENSES', label: 'Pay Expenses', subLabel: 'Bills Due' },
  { type: 'GO', label: 'SALARY', subLabel: 'Mid-Year Payout' }, // 12
  { type: 'POLICY_VOTE', label: 'Policy Vote', subLabel: 'Cast Your Ballot' },
  { type: 'VACATION', label: 'Vacation', subLabel: 'Relax & Recovery' },
  { type: 'PAY_EXPENSES', label: 'Pay Expenses', subLabel: 'Bills Due' },
  { type: 'CHANCE', label: 'Random Chance', subLabel: 'Market News' },
  { type: 'POLICY_VOTE', label: 'Policy Vote', subLabel: 'Cast Your Ballot' },
  { type: 'POLICY_VOTE', label: 'Policy Vote', subLabel: 'Cast Your Ballot' }, // 18
  { type: 'VACATION', label: 'Vacation', subLabel: 'Relax & Recovery' },
  { type: 'PAY_EXPENSES', label: 'Pay Expenses', subLabel: 'Bills Due' },
  { type: 'CHANCE', label: 'Random Chance', subLabel: 'Market News' },
  { type: 'POLICY_VOTE', label: 'Policy Vote', subLabel: 'Cast Your Ballot' },
  { type: 'VACATION', label: 'Vacation', subLabel: 'Relax & Recovery' },
];

const COLORS: Record<SquareType, number> = {
  GO: 0x10b981,
  POLICY_VOTE: 0x3b82f6,
  VACATION: 0x8b5cf6,
  PAY_EXPENSES: 0xef4444,
  CHANCE: 0xeab308,
};

const TARGET_LABELS: Record<string, string> = {
  all: 'Everyone',
  worker: 'Workers',
  businessman: 'Businessmen',
  banker: 'Bankers',
  none: 'No one'
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
  const pauseMovementRef = useRef(false);

  const { 
    game, players, me, 
    rollDice, endTurn, useAbility, 
    resolveSquare, submitVote, resolvePolicyVote, 
    getWinners, clearActionMessage,
    createTrade, cancelTrade, respondToTrade, useExecutiveOrder,
    resolveEventRoll, resolveExpenseChoice, clearUnemploymentPending, clearEventRollPending
  } = useGameStore();

  const [isRolling, setIsRolling] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [showAbilityInfo, setShowAbilityInfo] = useState(false);
  const [activePolicy, setActivePolicy] = useState<any>(null);
  const [winners, setWinners] = useState<Player[]>([]);
  const [bankerChoice, setBankerChoice] = useState<boolean>(false);
  
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [tradeMoney, setTradeMoney] = useState(0);
  const [tradePop, setTradePop] = useState(0);
  const [tradeVote, setTradeVote] = useState<'YES' | 'NO'>('YES');
  
  const [incomingTrades, setIncomingTrades] = useState<PolicyTrade[]>([]);
  const [outgoingTrades, setOutgoingTrades] = useState<PolicyTrade[]>([]);

  const [isSpinning, setIsSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<number | null>(null);
  const [activeEventIndex, setActiveEventIndex] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);
  const wheelRotationRef = useRef<number>(0);
  const lastReportedIndexRef = useRef<number>(0);
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);
  const [unemploymentResult, setUnemploymentResult] = useState<{roll: number, isUnemployed: boolean, payout: number} | null>(null);
  const [visualDiceRoll, setVisualDiceRoll] = useState(1);
  const [showUnemploymentModal, setShowUnemploymentModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [currentEventType, setCurrentEventType] = useState<'VACATION' | 'PAY_EXPENSES' | null>(null);
  const [drawnExpenseCards, setDrawnExpenseCards] = useState<any[]>([]);

  // Sync Local Modal State with Backend Flags (Only one-way: Open only)
  useEffect(() => {
    if (me?.unemployment_roll_pending && game?.current_player_id === me?.id) {
      setShowUnemploymentModal(true);
    }
  }, [me?.unemployment_roll_pending, game?.current_player_id, me?.id]);

  useEffect(() => {
    if (me?.event_roll_pending && game?.current_player_id === me?.id) {
      setShowEventModal(true);
      setCurrentEventType(me.event_roll_pending as 'VACATION' | 'PAY_EXPENSES');

      if (me.event_roll_pending === 'PAY_EXPENSES') {
        const cheap = CHEAP_EXPENSES[Math.floor(Math.random() * CHEAP_EXPENSES.length)];
        let validSpecial = SPECIAL_EXPENSES;
        if (me.class !== 'Politician') {
          validSpecial = validSpecial.filter(c => c.id !== 'community_fund');
        }
        const shuffledSpecial = [...validSpecial].sort(() => 0.5 - Math.random());
        setDrawnExpenseCards([cheap, ...shuffledSpecial.slice(0, 2)]);
      }
    }
  }, [me?.event_roll_pending, game?.current_player_id, me?.id]);

  const THEMATIC_EVENTS = {
    VACATION: [
      { icon: "🏖️", label: "Staycation in the Backyard" },
      { icon: "🏕️", label: "Weekend Camping Trip" },
      { icon: "🎢", label: "Theme Park Adventure" },
      { icon: "🚢", label: "Caribbean Cruise" },
      { icon: "🍕", label: "Gourmet Trip to Italy" },
      { icon: "🏝️", label: "Luxury Private Island" }
    ],
    PAY_EXPENSES: [
      { icon: "☕", label: "Artisanal Coffee Habit" },
      { icon: "📱", label: "Premium Phone Bill" },
      { icon: "🚗", label: "Major Car Maintenance" },
      { icon: "🏥", label: "Unexpected Medical Bill" },
      { icon: "🏠", label: "House Mortgage Due" },
      { icon: "⚖️", label: "Elite Legal Fees" }
    ]
  };

  const [isPixiReady, setIsPixiReady] = useState(false);
  const [boardScale, setBoardScale] = useState(1);

  // Adaptive Scaling
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const availableWidth = window.innerWidth * 0.6;
        const availableHeight = window.innerHeight * 0.6;
        const scale = Math.min(availableWidth / BOARD_PX, availableHeight / BOARD_PX, 1);
        setBoardScale(scale);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [isPixiReady]);

  const [logs, setLogs] = useState<any[]>([]);
  const [nextPolicy, setNextPolicy] = useState<any>(null);

  // Trades Subscription
  useEffect(() => {
    if (game?.voting_active && me?.id) {
      const fetchTrades = async () => {
        const { data: incoming } = await supabase.from('policy_trades').select('*').eq('game_id', game.id).eq('target_id', me.id).eq('status', 'PENDING');
        const { data: outgoing } = await supabase.from('policy_trades').select('*').eq('game_id', game.id).eq('proposer_id', me.id).eq('status', 'PENDING');
        setIncomingTrades(incoming || []);
        setOutgoingTrades(outgoing || []);
      };
      fetchTrades();
      const channel = supabase.channel(`trades-${me.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'policy_trades', filter: `game_id=eq.${game.id}` }, fetchTrades)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } else {
      setIncomingTrades([]);
      setOutgoingTrades([]);
    }
  }, [game?.voting_active, game?.id, me?.id]);

  const handleResolveUnemployment = async () => {
    if (!me || isRolling) return;
    
    setIsRolling(true);
    setUnemploymentResult(null);

    // Dice roll animation (Spinning)
    let frames = 0;
    const maxFrames = 20;
    const interval = setInterval(() => {
      setVisualDiceRoll(Math.floor(Math.random() * 6) + 1);
      frames++;
      if (frames >= maxFrames) {
        clearInterval(interval);
      }
    }, 80);

    await new Promise(r => setTimeout(r, 1800));
    
    const result = await gameService.resolveWorkerUnemployment(me.id, Math.floor(Math.random() * 6) + 1, [0, 12].includes(me.position));
    if (result) {
      setVisualDiceRoll(result.roll);
      setUnemploymentResult({ roll: result.roll, isUnemployed: result.isUnemployed, payout: result.finalPayout });
    }
    
    setIsRolling(false);
  };

  const handleCloseUnemploymentModal = async () => {
    await clearUnemploymentPending();
    setUnemploymentResult(null);
    setShowUnemploymentModal(false);
    setIsProcessingPayout(false);
    pauseMovementRef.current = false;
  };

  const handleResolveEvent = async () => {
    if (!me || !me.event_roll_pending || isSpinning) return;
    
    setIsSpinning(true);
    setSpinResult(null);
    
    const finalRoll = Math.floor(Math.random() * 6) + 1; // 1 to 6
    const targetMod = finalRoll - 1;
    
    const startRot = wheelRotationRef.current;
    let currentMod = Math.round(Math.abs(startRot) / 60) % 6;
    
    let stepsToTake = targetMod - currentMod;
    if (stepsToTake <= 0) stepsToTake += 6;
    stepsToTake += 24; // 4 full rotations
    
    const targetRot = startRot - (stepsToTake * 60);
    const startTime = performance.now();
    const duration = 4000;
    
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
    
    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = easeOutQuart(progress);
      
      const currentRot = startRot + (targetRot - startRot) * ease;
      wheelRotationRef.current = currentRot;
      
      if (wheelRef.current) {
        wheelRef.current.style.transform = `rotate(${currentRot}deg)`;
      }
      
      const currentIndex = Math.round(Math.abs(currentRot) / 60) % 6;
      if (currentIndex !== lastReportedIndexRef.current) {
        lastReportedIndexRef.current = currentIndex;
        setActiveEventIndex(currentIndex);
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setSpinResult(finalRoll);
        setIsSpinning(false);
      }
    };
    
    requestAnimationFrame(animate);
  };

  const handleCloseEventModal = async () => {
    if (me && spinResult) {
      await resolveEventRoll(me.event_roll_pending!, spinResult);
      await clearEventRollPending();
      setSpinResult(null);
      setShowEventModal(false);
      pauseMovementRef.current = false;
    }
  };

  // Fetch Next Policy
  useEffect(() => {
    if (game?.next_policy_id) {
      const fetchNext = async () => {
        const { data } = await supabase.from('policy_cards').select('*').eq('id', game.next_policy_id).single();
        setNextPolicy(data);
      };
      fetchNext();
    }
  }, [game?.next_policy_id]);

  // Action Log Subscription
  useEffect(() => {
    if (game?.id) {
      const fetchLogs = async () => {
        const { data } = await supabase.from('action_logs').select('*').eq('game_id', game.id).order('created_at', { ascending: false }).limit(20);
        setLogs(data || []);
      };
      fetchLogs();
      const channel = supabase.channel(`logs-${game.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'action_logs', filter: `game_id=eq.${game.id}` }, (payload) => {
        setLogs(prev => [payload.new, ...prev].slice(0, 20));
      }).subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [game?.id]);

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
      } else {
        setActivePolicy(null);
      }
    };
    fetchPolicy();
  }, [game?.current_policy_id]);

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

      if (isDestroyed) { 
        try { app.destroy(true, { children: true, texture: true }); } catch (e) { console.warn('PixiJS early cleanup warning:', e); }
        return; 
      }
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
          app.ticker?.stop();
          setTimeout(() => {
            try { app?.destroy(true, { children: true, texture: true }); } catch (e) { console.warn('PixiJS deferred cleanup warning:', e); }
          }, 0);
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
          
          container.rotation = (Math.random() - 0.5) * 0.1;
          container.scale.set(1 + Math.sin(app.ticker.lastTime * 0.02) * 0.1);
        }
      } else if (game?.last_roll) {
        if (container.children.length === 0 || (container.children[1] as PIXI.Text)?.text !== game.last_roll.toString()) {
           container.removeChildren();
           container.rotation = 0;
           
           const diceBg = new PIXI.Graphics();
           diceBg.roundRect(-45, -45, 90, 90, 16);
           diceBg.fill(0xffffff);
           diceBg.setStrokeStyle({ width: 6, color: 0x10b981 }); 
           diceBg.stroke();
           container.addChild(diceBg);

           const diceText = new PIXI.Text({
             text: game.last_roll.toString(),
             style: { fontSize: 56, fill: 0x0f172a, fontWeight: '900' }
           });
           diceText.anchor.set(0.5);
           container.addChild(diceText);
           
           container.scale.set(1.5);
        }
        const settleSpeed = 0.15 * delta.deltaTime;
        container.scale.set(container.scale.x + (1 - container.scale.x) * Math.min(1, settleSpeed));
      } else {
        container.removeChildren();
      }
    };
    app.ticker.add(diceTicker);
    return () => { app?.ticker?.remove(diceTicker); };
  }, [isRolling, game?.last_roll]);

  // TICKER: MOVEMENT
  useEffect(() => {
    if (!appRef.current || !isPixiReady) return;
    const app = appRef.current;

    const moveTicker = (delta: PIXI.Ticker) => {
      if (pauseMovementRef.current) return;

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

            if (player.id === me?.id && [0, 12].includes(nextStep)) {
              const isLanding = (nextStep === player.position);
              if (player.class === 'Worker') {
                setIsProcessingPayout(true);
                pauseMovementRef.current = true;
              }
              gameService.processSalaryPayout(player.id, isLanding);
            }
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
          const p = players.find(p => id === p.id);
          return p && p.position !== pos;
        });
        if (!stillActive) setIsMoving(false);
      }
    };
    app.ticker.add(moveTicker);
    return () => { app?.ticker?.remove(moveTicker); };
  }, [players, isPixiReady, isMoving, me?.id]);

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

  const handleSendTrade = async () => {
    if (selectedTargetId) {
      await createTrade(selectedTargetId, tradeMoney, tradePop, tradeVote);
      setSelectedTargetId(null);
      setTradeMoney(0);
      setTradePop(0);
    }
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-950 overflow-hidden">
      {/* 1. Policy Deck (Left) */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-64 space-y-6 z-20">
        <div className="bg-slate-900/90 backdrop-blur-xl border-2 border-slate-700 p-6 rounded-[2.5rem] shadow-2xl relative">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 block text-center">Policy Pipeline</span>
          
          <div className="relative aspect-[3/4] w-full group">
            <div className="absolute inset-0 bg-slate-800/40 rounded-3xl border-2 border-slate-700 translate-x-2 translate-y-2 -z-10" />
            <div className="absolute inset-0 bg-slate-800/60 rounded-3xl border-2 border-slate-700 translate-x-1 translate-y-1 -z-10" />
            
            <div className="relative h-full w-full bg-slate-800 rounded-3xl border-2 border-slate-700 overflow-hidden shadow-xl">
              {nextPolicy ? (
                <div className="p-5 h-full flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Next Up</span>
                    <h4 className="text-lg font-black text-white leading-tight mt-1">{nextPolicy.name}</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-slate-500">GDP</span>
                      <span className={nextPolicy.gdp_mod > 0 ? 'text-emerald-400' : 'text-rose-400'}>{nextPolicy.gdp_mod > 0 ? '+' : ''}{nextPolicy.gdp_mod}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-slate-500">INF</span>
                      <span className={nextPolicy.inflation_mod > 0 ? 'text-violet-400' : 'text-rose-400'}>{nextPolicy.inflation_mod > 0 ? '+' : ''}{nextPolicy.inflation_mod}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-slate-500">UNP</span>
                      <span className={nextPolicy.unemployment_mod > 0 ? 'text-rose-400' : 'text-emerald-400'}>{nextPolicy.unemployment_mod > 0 ? '+' : ''}{nextPolicy.unemployment_mod}</span>
                    </div>

                    {(nextPolicy.tax_mod !== 0 || nextPolicy.money_delta !== 0 || nextPolicy.min_salary_set !== null) && (
                      <div className="pt-2 mt-2 border-t border-slate-700/50 space-y-1">
                        {nextPolicy.tax_mod !== 0 && (
                          <div className="flex justify-between text-[9px] font-black uppercase">
                            <span className="text-slate-400">Tax</span>
                            <span className={nextPolicy.tax_mod > 0 ? 'text-rose-400' : 'text-emerald-400'}>{nextPolicy.tax_mod > 0 ? '+' : ''}{nextPolicy.tax_mod}%</span>
                          </div>
                        )}
                        {nextPolicy.money_delta !== 0 && (
                          <div className="flex justify-between text-[9px] font-black uppercase">
                            <span className="text-slate-400">{TARGET_LABELS[nextPolicy.money_target]}</span>
                            <span className={nextPolicy.money_delta > 0 ? 'text-emerald-400' : 'text-rose-400'}>{nextPolicy.money_delta > 0 ? '+' : ''}${Math.abs(nextPolicy.money_delta)}</span>
                          </div>
                        )}
                        {nextPolicy.min_salary_set !== null && (
                          <div className="flex justify-between text-[9px] font-black uppercase">
                            <span className="text-slate-400">Min Wage</span>
                            <span className="text-blue-400">${nextPolicy.min_salary_set}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-600 font-black text-sm uppercase tracking-widest">Shuffling...</div>
              )}
            </div>
          </div>
          
          <div className="mt-6 flex gap-1.5 justify-center">
            {[1, 2, 3, 4].map(i => <div key={i} className="w-1.5 h-1.5 bg-slate-800 rounded-full" />)}
          </div>
        </div>
      </div>

      {/* 2. Win Condition Tracker (Right) */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 w-64 space-y-6 z-20">
        <div className="bg-slate-900/90 backdrop-blur-xl border-2 border-slate-700 p-6 rounded-[2.5rem] shadow-2xl">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 block text-center">Your Objectives</span>
          <div className="space-y-4">
            {me?.class === 'Worker' && (
              <>
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${me.balance >= 150 ? 'bg-emerald-500 border-emerald-400' : 'border-slate-700'}`}>
                    {me.balance >= 150 && <span className="text-[10px] text-white">✓</span>}
                  </div>
                  <span className={`text-xs font-bold ${me.balance >= 150 ? 'text-white' : 'text-slate-500'}`}>Accumulate $150</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${(game?.unemployment || 0) <= 2 ? 'bg-emerald-500 border-emerald-400' : 'border-slate-700'}`}>
                    {(game?.unemployment || 0) <= 2 && <span className="text-[10px] text-white">✓</span>}
                  </div>
                  <span className={`text-xs font-bold ${(game?.unemployment || 0) <= 2 ? 'text-white' : 'text-slate-500'}`}>Unemployment ≤ 2</span>
                </div>
              </>
            )}
            {me?.class === 'Businessman' && (
              <>
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${me.balance >= 300 ? 'bg-emerald-500 border-emerald-400' : 'border-slate-700'}`}>
                    {me.balance >= 300 && <span className="text-[10px] text-white">✓</span>}
                  </div>
                  <span className={`text-xs font-bold ${me.balance >= 300 ? 'text-white' : 'text-slate-500'}`}>Accumulate $300</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${(game?.gdp || 0) >= 4 ? 'bg-emerald-500 border-emerald-400' : 'border-slate-700'}`}>
                    {(game?.gdp || 0) >= 4 && <span className="text-[10px] text-white">✓</span>}
                  </div>
                  <span className={`text-xs font-bold ${(game?.gdp || 0) >= 4 ? 'text-white' : 'text-slate-500'}`}>GDP Growth ≥ 4</span>
                </div>
              </>
            )}
            <div className="pt-4 border-t border-slate-800">
              <p className="text-[9px] text-center text-slate-600 font-black uppercase tracking-widest">Year {game?.year || 1} / 10</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Global HUD */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-8 bg-slate-900/90 backdrop-blur-xl border-2 border-slate-700 p-6 rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] z-20">
        <div className="flex flex-col items-center gap-3 w-36">
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none">GDP Growth</span>
          <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700 relative">
            <div 
              className="h-full bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all duration-1000 ease-out"
              style={{ width: `${(game?.gdp || 3) * 10}%` }}
            />
          </div>
          <div className="w-full flex justify-between px-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <span key={n} className={`text-[8px] font-black ${(game?.gdp || 3) === n ? 'text-emerald-400 scale-125' : 'text-slate-600'}`}>{n}</span>
            ))}
          </div>
        </div>

        <div className="w-px h-12 bg-slate-700 self-center mb-4" />

        <div className="flex flex-col items-center gap-3 w-36">
          <span className="text-[10px] font-black text-violet-500 uppercase tracking-widest leading-none">Inflation</span>
          <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700 relative">
            <div 
              className="h-full bg-violet-500 shadow-[0_0_20px_rgba(124,58,237,0.5)] transition-all duration-1000 ease-out"
              style={{ width: `${(game?.inflation || 3) * 10}%` }}
            />
          </div>
          <div className="w-full flex justify-between px-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <span key={n} className={`text-[8px] font-black ${(game?.inflation || 3) === n ? 'text-violet-400 scale-125' : 'text-slate-600'}`}>{n}</span>
            ))}
          </div>
        </div>

        <div className="w-px h-12 bg-slate-700 self-center mb-4" />

        <div className="flex flex-col items-center gap-3 w-36">
          <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest leading-none">Unemployment</span>
          <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700 relative">
            <div 
              className="h-full bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)] transition-all duration-1000 ease-out"
              style={{ width: `${(game?.unemployment || 3) * 10}%` }}
            />
          </div>
          <div className="w-full flex justify-between px-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <span key={n} className={`text-[8px] font-black ${(game?.unemployment || 3) === n ? 'text-rose-400 scale-125' : 'text-slate-600'}`}>{n}</span>
            ))}
          </div>
        </div>
        <div className="w-px h-12 bg-slate-700 self-center" />
        <div className="flex flex-col items-center justify-center px-4">
          <span className="text-3xl font-[1000] text-white tracking-tighter">YEAR {game?.year || 1}</span>
          <div className="flex gap-3 mt-1">
            <span className="text-[10px] text-amber-500 font-black uppercase tracking-widest">Tax: {game?.tax_rate}%</span>
            <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest">Min Wage: ${game?.min_salary}</span>
          </div>
        </div>
      </div>

      {/* 4. Center Log (Cascading Messages) */}
      <div className="absolute top-[62%] left-1/2 -translate-x-1/2 w-full max-w-lg pointer-events-none z-10 flex flex-col items-center">
        <div className="flex flex-col items-center gap-1.5">
          {logs.slice(0, 4).map((log, idx) => {
            const p = players.find(p => p.id === log.player_id);
            const scale = 1 - (idx * 0.1);
            const opacity = idx === 0 ? 1 : idx === 1 ? 0.8 : idx === 2 ? 0.5 : 0.2;
            
            return (
              <div 
                key={log.id} 
                className={`flex items-center gap-2 transition-all duration-700 ease-out ${idx === 0 ? 'animate-in slide-in-from-top-4 fade-in duration-500' : ''}`}
                style={{ 
                  transform: `scale(${scale})`,
                  opacity: opacity
                }}
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${p?.class === 'Worker' ? 'bg-blue-500' : p?.class === 'Businessman' ? 'bg-amber-500' : p?.class === 'Banker' ? 'bg-emerald-500' : p?.class === 'Politician' ? 'bg-violet-500' : 'bg-slate-500'}`} />
                <span className={`text-[10px] font-black uppercase tracking-tighter shrink-0 ${idx === 0 ? 'text-white' : idx === 1 ? 'text-slate-300' : 'text-slate-500'}`}>
                  {p?.name || 'SYSTEM'}:
                </span>
                <p className={`text-[11px] font-bold leading-none ${idx === 0 ? 'text-blue-50' : idx === 1 ? 'text-slate-300' : 'text-slate-500'}`}>
                  {log.message}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Scaled Game Board */}
      <div 
        ref={containerRef} 
        style={{ transform: `scale(${boardScale})` }}
        className="shadow-[0_0_120px_rgba(0,0,0,0.8)] rounded-2xl border-[12px] border-slate-800 overflow-hidden bg-slate-900 transition-transform duration-500" 
      />

      {/* 6. Overlays (Votes, Modals, etc.) */}
      {showUnemploymentModal && game?.current_player_id === me?.id && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border-4 border-rose-500/50 w-full max-w-md rounded-[3rem] p-10 text-center space-y-8 shadow-[0_0_100px_rgba(244,63,94,0.2)] relative">
            {unemploymentResult && !isRolling && (
              <button 
                onClick={handleCloseUnemploymentModal}
                className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-black text-xl transition-all shadow-md active:translate-y-0.5"
              >
                ✕
              </button>
            )}
            <div><span className="text-[10px] font-black text-rose-400 uppercase tracking-[0.3em] mb-2 block">Mandatory Check</span><h2 className="text-3xl font-[1000] text-white tracking-tighter uppercase">Employment Roll</h2></div>
            
            <div className="flex flex-col items-center gap-6">
              <div className="w-24 h-24 bg-white rounded-3xl border-4 border-slate-700 flex items-center justify-center shadow-2xl relative overflow-hidden">
                <span className={`text-6xl font-black text-slate-900`}>{visualDiceRoll}</span>
              </div>

              {!unemploymentResult && !isRolling ? (
                <>
                  <p className="text-slate-400 font-medium">The market is volatile. Roll the dice to see if you are employed for this district payout.</p>
                  <button onClick={handleResolveUnemployment} className="w-full py-6 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black text-2xl transition-all shadow-[0_8px_0_rgb(159,18,57)] active:translate-y-1 active:shadow-none">ROLL FOR WORK</button>
                </>
              ) : unemploymentResult ? (
                <div className="animate-in fade-in zoom-in-95 duration-500 flex flex-col items-center">
                  <div className={`px-6 py-2 rounded-full border-2 mb-4 font-black uppercase tracking-widest ${unemploymentResult.isUnemployed ? 'bg-rose-500/20 border-rose-500 text-rose-500' : 'bg-emerald-500/20 border-emerald-500 text-emerald-500'}`}>
                    {unemploymentResult.isUnemployed ? 'Unemployed' : 'Employed'}
                  </div>
                  <p className={`text-5xl font-[1000] ${unemploymentResult.isUnemployed ? 'text-slate-500' : 'text-emerald-400'}`}>
                    ${unemploymentResult.payout}
                  </p>
                  {!isRolling && (
                    <button onClick={handleCloseUnemploymentModal} className="mt-8 w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-xl transition-all shadow-[0_6px_0_rgb(51,65,85)] active:translate-y-1 active:shadow-none">
                      ✕ CLOSE
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {showEventModal && game?.current_player_id === me?.id && currentEventType && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-in fade-in duration-300">
          <div className={`bg-slate-900 border-4 ${currentEventType === 'PAY_EXPENSES' ? 'border-rose-500/50 shadow-[0_0_100px_rgba(244,63,94,0.2)]' : 'border-blue-500/50 shadow-[0_0_100px_rgba(59,130,246,0.2)]'} w-full ${currentEventType === 'PAY_EXPENSES' ? 'max-w-3xl' : 'max-w-md'} rounded-[3rem] p-10 text-center space-y-8 relative overflow-hidden`}>
            {/* Spinner Wheel UI */}
            {/* Spinner Wheel UI (Only for Vacation) */}
            {currentEventType === 'VACATION' ? (
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-8 block">Relax & Reward</span>
                
                <div className="relative w-64 h-64 mb-8">
                  {/* Pointer */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10 text-3xl">👇</div>
                  
                  {/* Wheel */}
                  <div 
                    ref={wheelRef}
                    className={`w-full h-full rounded-full border-4 border-slate-700 bg-slate-800 relative`}
                    style={{ 
                      transform: `rotate(${wheelRotationRef.current}deg)`
                    }}
                  >
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div 
                        key={i}
                        className="absolute top-0 left-0 w-full h-full flex flex-col items-center pt-4 origin-bottom"
                        style={{ transform: `rotate(${i * 60}deg)`, height: '50%' }}
                      >
                        <span className="text-2xl">{THEMATIC_EVENTS[currentEventType][i].icon}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {!spinResult && !isSpinning ? (
                  <>
                    <h2 className="text-3xl font-[1000] text-white tracking-tighter uppercase mb-4">Luxury Vacation</h2>
                    <p className="text-slate-400 font-medium mb-8">Spin the wheel to see your travel costs!</p>
                    <button onClick={handleResolveEvent} className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-2xl transition-all shadow-[0_8px_0_rgb(30,64,175)] active:translate-y-1 active:shadow-none">SPIN FOR IMPACT</button>
                  </>
                ) : (
                  <div className="animate-in fade-in zoom-in-95 duration-500 flex flex-col items-center">
                    <span className="text-6xl mb-4">{THEMATIC_EVENTS[currentEventType][activeEventIndex].icon}</span>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
                      {THEMATIC_EVENTS[currentEventType][activeEventIndex].label}
                    </h2>
                    {spinResult && (
                      <p className={`text-4xl font-[1000] text-rose-400`}>
                        -${Math.floor((spinResult * calculateSalary(me.class, game.gdp, game.inflation, game.unemployment, me.popularity, game.tax_rate, game.min_salary)) / 5)}
                      </p>
                    )}
                    {!isSpinning && spinResult && (
                      <button onClick={handleCloseEventModal} className="mt-8 w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-xl transition-all shadow-[0_6px_0_rgb(51,65,85)] active:translate-y-1 active:shadow-none">
                        ✕ CLOSE
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Expense Card Selection UI (Vertical Layout) */
              <div className="flex flex-col items-center w-full">
                <span className="text-[10px] font-black text-rose-400 uppercase tracking-[0.3em] mb-8 block text-center w-full">Economic Dues</span>
                <h2 className="text-4xl font-[1000] text-white tracking-tighter uppercase mb-2">Select a Contribution to Pay</h2>
                <p className="text-slate-400 font-medium mb-8 text-center max-w-lg">The economy requires capital. Choose your payment.</p>

                <div className="flex flex-col gap-3 w-full">
                  {drawnExpenseCards.map((card) => {
                    const baseCost = Math.floor(calculateSalary(me.class, game.gdp, game.inflation, game.unemployment, me.popularity, game.tax_rate, game.min_salary) / 5);
                    const cost = card.cost_multiplier * baseCost;
                    return (
                      <button 
                        key={card.id}
                        onClick={async () => {
                          await resolveExpenseChoice(card.id);
                          setShowEventModal(false);
                          pauseMovementRef.current = false;
                        }}
                        className="group relative bg-slate-900/50 border-2 border-rose-500/30 hover:border-rose-500 rounded-3xl p-5 text-left transition-all hover:scale-[1.01] flex items-center justify-between gap-6 shadow-xl overflow-hidden"
                      >
                        {/* Cost and Title (Left) */}
                        <div className="flex flex-col w-[30%] shrink-0">
                          <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Mandatory Payment</span>
                          <h4 className="text-lg font-[1000] text-white leading-tight uppercase mb-2">{card.name}</h4>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-black text-rose-500">-${cost}</span>
                          </div>
                        </div>

                        {/* Description (Right) */}
                        <div className="flex-1 border-l border-rose-500/20 pl-6">
                          <p className="text-[13px] font-bold text-slate-300 leading-snug">{card.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {game?.voting_active && activePolicy && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border-4 border-slate-800 w-full max-w-4xl rounded-[3rem] shadow-[0_0_100px_rgba(59,130,246,0.2)] overflow-hidden flex h-[80vh]">
             {/* Left: Policy Info */}
             <div className="w-1/3 bg-slate-800/50 p-10 border-r border-slate-700 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-4 block">Policy Proposal</span>
                  <h2 className="text-4xl font-[1000] text-white tracking-tighter leading-none mb-6">{activePolicy.name}</h2>
                  <div className="space-y-4">
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Projected Impact</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="flex flex-col"><span className="text-xl font-black text-emerald-400">{activePolicy.gdp_mod > 0 ? '+' : ''}{activePolicy.gdp_mod}</span><span className="text-[8px] font-black text-slate-500">GDP</span></div>
                        <div className="flex flex-col"><span className="text-xl font-black text-violet-400">{activePolicy.inflation_mod > 0 ? '+' : ''}{activePolicy.inflation_mod}</span><span className="text-[8px] font-black text-slate-500">INF</span></div>
                        <div className="flex flex-col"><span className="text-xl font-black text-rose-400">{activePolicy.unemployment_mod > 0 ? '+' : ''}{activePolicy.unemployment_mod}</span><span className="text-[8px] font-black text-slate-500">UNP</span></div>
                      </div>
                    </div>

                    {(activePolicy.tax_mod !== 0 || activePolicy.money_delta !== 0 || activePolicy.min_salary_set !== null) && (
                      <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/20 space-y-3">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Financial Directives</p>
                        <div className="space-y-2">
                          {activePolicy.tax_mod !== 0 && (
                            <div className="flex justify-between items-center text-xs font-bold">
                              <span className="text-slate-400 uppercase tracking-tighter">Income Tax</span>
                              <span className={activePolicy.tax_mod > 0 ? 'text-rose-400' : 'text-emerald-400'}>{activePolicy.tax_mod > 0 ? '+' : ''}{activePolicy.tax_mod}%</span>
                            </div>
                          )}
                          {activePolicy.money_delta !== 0 && (
                            <div className="flex justify-between items-center text-xs font-bold">
                              <span className="text-slate-400 uppercase tracking-tighter">{TARGET_LABELS[activePolicy.money_target]}</span>
                              <span className={activePolicy.money_delta > 0 ? 'text-emerald-400' : 'text-rose-400'}>{activePolicy.money_delta > 0 ? 'Gain' : 'Lose'} ${Math.abs(activePolicy.money_delta)}</span>
                            </div>
                          )}
                          {activePolicy.min_salary_set !== null && (
                            <div className="flex justify-between items-center text-xs font-bold">
                              <span className="text-slate-400 uppercase tracking-tighter">Min Salary</span>
                              <span className="text-blue-400">${activePolicy.min_salary_set}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs font-black text-slate-500 uppercase"><span>Your Weight</span><span className="text-white text-lg">{me?.class === 'Worker' || me?.class === 'Politician' ? '2' : '1'} VOTES</span></div>
                  <div className="flex gap-3">
                    <button onClick={() => submitVote('YES')} className={`flex-1 py-4 rounded-xl font-black text-lg transition-all ${me?.vote_confirmed ? 'opacity-50 pointer-events-none' : ''} bg-emerald-600 text-white shadow-[0_4px_0_rgb(5,150,105)] active:translate-y-1`}>YES</button>
                    <button onClick={() => submitVote('NO')} className={`flex-1 py-4 rounded-xl font-black text-lg transition-all ${me?.vote_confirmed ? 'opacity-50 pointer-events-none' : ''} bg-rose-600 text-white shadow-[0_4px_0_rgb(225,29,72)] active:translate-y-1`}>NO</button>
                  </div>
                </div>
             </div>

             {/* Right: Negotiation & Trading */}
             <div className="flex-1 p-10 flex flex-col">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-[1000] text-white tracking-tight uppercase">Negotiation Table</h3>
                  <div className="flex items-center gap-2 bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/20">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Confirmed</span>
                    <span className="text-lg font-black text-white">{players.filter(p => p.vote_confirmed).length} / {players.length}</span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6 pr-4">
                  {/* Executive Order for Politician */}
                  {me?.class === 'Politician' && !me.exec_order_used_this_year && (
                    <div className="bg-amber-500/10 border-2 border-amber-500/50 p-6 rounded-[2rem] space-y-4 animate-in zoom-in-95 duration-500">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-xl">⚖️</div>
                        <div><p className="text-sm font-black text-amber-500 uppercase tracking-widest">Executive Order Available</p><p className="text-xs text-amber-200/60 font-medium">Bypass the vote and force an outcome immediately.</p></div>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => useExecutiveOrder('YES')} className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-black text-sm transition-all">FORCE PASS</button>
                        <button onClick={() => useExecutiveOrder('NO')} className="flex-1 py-3 border-2 border-amber-600 text-amber-500 hover:bg-amber-600 hover:text-white rounded-xl font-black text-sm transition-all">FORCE FAIL</button>
                      </div>
                    </div>
                  )}

                  {/* Incoming Trades */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-2">Incoming Offers</span>
                    <div className="bg-slate-800/50 p-4 rounded-3xl border border-slate-700 min-h-[100px] flex flex-col justify-center items-center">
                       {incomingTrades.length > 0 ? (
                         <div className="w-full space-y-3">
                           {incomingTrades.map(trade => {
                             const proposer = players.find(p => p.id === trade.proposer_id);
                             return (
                               <div key={trade.id} className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 space-y-4 animate-in slide-in-from-top-2">
                                 <div className="flex justify-between items-center">
                                   <div className="flex items-center gap-2">
                                     <div className={`w-2 h-2 rounded-full ${proposer?.class === 'Worker' ? 'bg-blue-500' : proposer?.class === 'Businessman' ? 'bg-amber-500' : proposer?.class === 'Banker' ? 'bg-emerald-500' : 'bg-violet-500'}`} />
                                     <span className="text-[10px] font-black text-white uppercase">{proposer?.name} offers:</span>
                                   </div>
                                   <span className={`text-[10px] font-black uppercase ${trade.forced_vote === 'YES' ? 'text-emerald-500' : 'text-rose-500'}`}>Vote {trade.forced_vote}</span>
                                 </div>
                                 <div className="flex gap-4">
                                   {trade.money_offered > 0 && <span className="text-emerald-400 font-black text-xs">${trade.money_offered}</span>}
                                   {trade.popularity_offered > 0 && <span className="text-violet-400 font-black text-xs">{trade.popularity_offered} POP</span>}
                                 </div>
                                 <div className="flex gap-2">
                                   <button onClick={() => respondToTrade(trade.id, true)} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-black text-[10px] uppercase">Accept</button>
                                   <button onClick={() => respondToTrade(trade.id, false)} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg font-black text-[10px] uppercase">Decline</button>
                                 </div>
                               </div>
                             );
                           })}
                         </div>
                       ) : (
                         <p className="text-xs font-bold text-slate-600 uppercase">No active proposals for you</p>
                       )}
                    </div>
                  </div>

                  {/* Send Trade UI */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-2">Initiate Trade</span>
                    <div className="bg-slate-800/50 p-6 rounded-[2.5rem] border border-slate-700 space-y-6">
                       {selectedTargetId ? (
                         <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                            {/* Selected Target Header */}
                            <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-2xl border border-blue-500/30">
                              <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${players.find(p => p.id === selectedTargetId)?.class === 'Worker' ? 'bg-blue-500' : players.find(p => p.id === selectedTargetId)?.class === 'Businessman' ? 'bg-amber-500' : players.find(p => p.id === selectedTargetId)?.class === 'Banker' ? 'bg-emerald-500' : 'bg-violet-500'}`} />
                                <span className="text-xs font-black text-white uppercase">{players.find(p => p.id === selectedTargetId)?.name}</span>
                              </div>
                              <button onClick={() => setSelectedTargetId(null)} className="text-slate-500 hover:text-white transition-colors"><span className="text-xs font-black uppercase tracking-widest">Cancel</span></button>
                            </div>

                            {/* Trading Sliders */}
                            <div className="space-y-6">
                               <div className="space-y-3">
                                 <div className="flex justify-between text-[10px] font-black uppercase text-slate-500"><span>Offer Money</span><span className="text-emerald-500">${tradeMoney}</span></div>
                                 <input type="range" min="0" max={me?.balance || 0} step="5" value={tradeMoney} onChange={(e) => setTradeMoney(parseInt(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                               </div>
                               
                               {(me?.class !== 'Worker' || players.find(p => p.id === selectedTargetId)?.class === 'Politician') && (
                                 <div className="space-y-3">
                                   <div className="flex justify-between text-[10px] font-black uppercase text-slate-500"><span>Offer Popularity</span><span className="text-violet-500">{tradePop} Points</span></div>
                                   <input type="range" min="0" max={me?.class === 'Worker' ? 10 : (me?.popularity || 0)} step="1" value={tradePop} onChange={(e) => setTradePop(parseInt(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500" />
                                   {me?.class === 'Worker' && <p className="text-[8px] text-slate-600 font-bold uppercase italic">* Workers grant virtual points to the target</p>}
                                 </div>
                               )}

                               <div className="space-y-3">
                                 <div className="flex justify-between text-[10px] font-black uppercase text-slate-500"><span>Coerce Vote</span><span className={tradeVote === 'YES' ? 'text-emerald-500' : 'text-rose-500'}>{tradeVote}</span></div>
                                 <div className="flex gap-2">
                                   <button onClick={() => setTradeVote('YES')} className={`flex-1 py-2 rounded-lg font-black text-xs transition-all ${tradeVote === 'YES' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-500'}`}>FOR YES</button>
                                   <button onClick={() => setTradeVote('NO')} className={`flex-1 py-2 rounded-lg font-black text-xs transition-all ${tradeVote === 'NO' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-slate-500'}`}>FOR NO</button>
                                 </div>
                               </div>

                               <button 
                                 onClick={handleSendTrade}
                                 className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm shadow-[0_4px_0_rgb(30,64,175)] active:translate-y-1 transition-all mt-4"
                               >
                                 SEND TRADE OFFER
                               </button>
                            </div>
                         </div>
                       ) : (
                         <div className="grid grid-cols-2 gap-4">
                           {players.filter(p => p.id !== me?.id).map(p => (
                             <button 
                               key={p.id} 
                               onClick={() => setSelectedTargetId(p.id)}
                               className="p-4 bg-slate-900/50 border border-slate-700 rounded-2xl text-left hover:border-blue-500 transition-all group"
                             >
                               <div className="flex items-center gap-3">
                                 <div className={`w-3 h-3 rounded-full ${p.class === 'Worker' ? 'bg-blue-500' : p.class === 'Businessman' ? 'bg-amber-500' : p.class === 'Banker' ? 'bg-emerald-500' : 'bg-violet-500'}`} />
                                 <span className="text-xs font-black text-white uppercase group-hover:text-blue-400">{p.name}</span>
                               </div>
                             </button>
                           ))}
                         </div>
                       )}
                    </div>
                  </div>
                </div>

                {game.current_player_id === me?.id && players.every(p => p.vote_confirmed) && (
                  <button onClick={handleResolveVote} className="mt-8 w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-[1000] text-xl shadow-[0_8px_0_rgb(30,64,175)]">FINALIZE DECISION</button>
                )}
             </div>
          </div>
        </div>
      )}

      {/* 7. Footer Controls */}
      <div className="absolute bottom-6 flex items-center justify-center gap-6 w-full z-10">
        <div className="flex items-center gap-6 bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[2.5rem] border-2 border-slate-700/50 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
          <button onClick={handleRoll} disabled={isRolling || game?.current_player_id !== me?.id || game?.has_rolled || me?.is_waiting_at_go || isMoving} className={`px-16 py-6 rounded-[2rem] font-[1000] text-3xl transition-all duration-300 ${(game?.current_player_id === me?.id && !game?.has_rolled && !me?.is_waiting_at_go) ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_10px_0_rgb(5,150,105)]' : 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-40'}`}>{isRolling ? 'ROLLING...' : me?.is_waiting_at_go ? 'AT GO' : 'ROLL DICE'}</button>
          <button onClick={endTurn} disabled={isRolling || game?.current_player_id !== me?.id || (!game?.has_rolled && !me?.is_waiting_at_go) || isMoving} className={`px-10 py-5 rounded-[1.5rem] font-black text-xl transition-all duration-300 ${(game?.current_player_id === me?.id && (game?.has_rolled || me?.is_waiting_at_go)) ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_6px_0_rgb(30,64,175)]' : 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-40'}`}>END TURN</button>
        </div>
      </div>
    </div>
  );
};
