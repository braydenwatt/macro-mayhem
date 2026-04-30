import React, { useState, useEffect } from 'react';
import { GameBoard } from './game/GameBoard';
import { useGameStore } from './hooks/useGameStore';
import { useGameSync } from './hooks/useGameSync';
import { gameService } from './services/gameService';
import { PlayerClass, Player, GameState } from './types/game';
import { getSalaryDetails } from './engine/economy';
import { Users, Plus, Play, UserCircle, Copy, CheckCircle2, Coins, Milestone, Info, LogOut, BookOpen, ArrowRight, Dice6, Landmark, BarChart3, Trophy, UsersRound, Megaphone, ShieldAlert } from 'lucide-react';
import './utils/testHelpers'; // Initialize test mode helpers
import { supabase } from './services/supabase';

const CLASS_INFO: Record<PlayerClass, { tag: string; desc: string; icon: string }> = {
  Worker: {
    tag: "The Laborer",
    desc: "Fixed Weight: 2. Ability: Strike to freeze Businessman and Worker salaries until minimum wage rises. Passive: rolls for unemployment at salary squares. High unemployment risks losing income. Trade popularity for voting influence.",
    icon: "🔨"
  },
  Businessman: {
    tag: "The Investor",
    desc: "Fixed Weight: 1. Ability: Purchase a business once per year and collect rent from vacation and expense squares. Passive: earns bonus income from GDP growth. Can bribe politicians to change policy outcomes.",
    icon: "💼"
  },
  Banker: {
    tag: "The Regulator",
    desc: "Fixed Weight: 1. When passing GO, choose GDP, inflation, or unemployment to move by 1. Passive: earns bonuses during economic stability but suffers penalties during high inflation.",
    icon: "🏦"
  },
  Politician: {
    tag: "The Leader",
    desc: "Fixed Weight: 1. Ability: Executive Order (Forces policy outcome). Passive: earns more money when popularity is high.",
    icon: "⚖️"
  }
};


const RULEBOOK_CLASSES: Array<{ className: PlayerClass; icon: string; accent: string; summary: string; objective: string }> = [
  {
    className: 'Worker',
    icon: '🔨',
    accent: 'from-blue-500/25 to-blue-600/5 border-blue-500/30',
    summary: '2 voting weight, starts with 3 popularity, gains extra popularity on salary turns, and can use Strike to pressure the table.',
    objective: 'Win with unemployment at 2 or lower and at least $150.',
  },
  {
    className: 'Businessman',
    icon: '💼',
    accent: 'from-amber-500/25 to-amber-600/5 border-amber-500/30',
    summary: '1 voting weight, earns more from GDP growth, can buy businesses once per year, and can use capital to sway votes.',
    objective: 'Win with at least $500.',
  },
  {
    className: 'Banker',
    icon: '🏦',
    accent: 'from-emerald-500/25 to-emerald-600/5 border-emerald-500/30',
    summary: '1 voting weight, adjusts one economic indicator when passing GO, and thrives when inflation is stable.',
    objective: 'Win with inflation exactly 3 and unemployment at 4 or lower.',
  },
  {
    className: 'Politician',
    icon: '⚖️',
    accent: 'from-violet-500/25 to-violet-600/5 border-violet-500/30',
    summary: '1 voting weight, starts at 0 popularity, can force one policy outcome per year, and earns more from popularity.',
    objective: 'Win with popularity at 7 or higher and inflation at 5 or lower.',
  },
];

const ECONOMY_INDICATORS = [
  {
    title: 'GDP',
    icon: BarChart3,
    color: 'text-blue-400',
    accent: 'border-blue-500/30 bg-blue-500/10',
    summary: 'Boosts Businessman income and powers growth effects.',
  },
  {
    title: 'Inflation',
    icon: ShieldAlert,
    color: 'text-amber-400',
    accent: 'border-amber-500/30 bg-amber-500/10',
    summary: 'Affects Banker bonuses and can punish salary stability.',
  },
  {
    title: 'Unemployment',
    icon: UsersRound,
    color: 'text-emerald-400',
    accent: 'border-emerald-500/30 bg-emerald-500/10',
    summary: 'Shapes Worker payouts and is a key win condition metric.',
  },
];

const RULEBOOK_SQUARES = [
  {
    title: 'GO / Salary',
    icon: Coins,
    accent: 'border-emerald-500/30 bg-emerald-500/10',
    text: 'Passing or landing on GO pays salary. Reaching the end of the board sends you back to GO and marks you waiting there.',
  },
  {
    title: 'Policy Vote',
    icon: Megaphone,
    accent: 'border-violet-500/30 bg-violet-500/10',
    text: 'Landing here starts or supports a policy vote. Trades and the Politician’s Executive Order can change the result.',
  },
  {
    title: 'Vacation',
    icon: Landmark,
    accent: 'border-blue-500/30 bg-blue-500/10',
    text: 'Triggers an expense-style event and can send money to a business owner if the square is owned.',
  },
  {
    title: 'Pay Expenses',
    icon: ShieldAlert,
    accent: 'border-rose-500/30 bg-rose-500/10',
    text: 'Choose one card, pay the cost, and resolve any global effect such as inflation, popularity, GDP, or unemployment changes.',
  },
  {
    title: 'Chance',
    icon: Dice6,
    accent: 'border-amber-500/30 bg-amber-500/10',
    text: 'Draw a random event card that can alter money, popularity, or the economy.',
  },
];

function RulebookModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[220] overflow-y-auto bg-black/80 px-4 py-6 backdrop-blur-2xl sm:px-6 sm:py-10"
      onClick={onClose}
    >
      <div
        className="mx-auto w-full max-w-[80vw] overflow-hidden rounded-[3rem] border-4 border-slate-800 bg-slate-950 shadow-[0_0_120px_rgba(0,0,0,0.65)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-slate-950 to-emerald-600 p-8 sm:p-10">
          <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.4em] text-white/80">
                <BookOpen className="h-4 w-4" />
                Rulebook
              </div>
              <div className="space-y-3">
                <h2 className="text-5xl font-[1000] tracking-tighter text-white sm:text-7xl">How to Play</h2>
                <p className="max-w-2xl text-sm font-bold uppercase tracking-[0.2em] text-white/70 sm:text-base">
                  4 players, 24 spaces, 3 public indicators, and a five-year cycle of salary, policy, and negotiation.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-white/15 bg-black/20 px-5 py-3 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-black/35"
            >
              Close
            </button>
          </div>

          <div className="relative mt-8 grid gap-4 md:grid-cols-3">
            {ECONOMY_INDICATORS.map((indicator) => {
              const Icon = indicator.icon;

              return (
                <div key={indicator.title} className={`rounded-[1.75rem] border-2 p-5 backdrop-blur ${indicator.accent}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/60">Public Indicator</p>
                      <h3 className={`mt-2 text-2xl font-[1000] uppercase tracking-tight text-white`}>{indicator.title}</h3>
                    </div>
                    <div className={`rounded-2xl bg-white/10 p-3 ${indicator.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-4 text-sm font-bold leading-relaxed text-white/70">{indicator.summary}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="max-h-[72vh] space-y-8 overflow-y-auto p-6 sm:p-10">
          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[2.5rem] border-2 border-slate-800 bg-slate-900/70 p-6 sm:p-8">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-2xl bg-blue-500/15 p-3 text-blue-400"><Info className="h-5 w-5" /></div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Overview</p>
                  <h3 className="text-3xl font-[1000] tracking-tight text-white">The Goal of the Cycle</h3>
                </div>
              </div>
              <div className="space-y-4 text-sm leading-relaxed text-slate-300 sm:text-base">
                <p>
                  Macro Mayhem is a 4-player economic strategy game where each player becomes a Worker, Businessman, Banker, or Politician.
                </p>
                <p>
                  Move around the 24-space board, collect salary, react to events, vote on policies, trade influence, and try to satisfy your class win condition before year 5 ends.
                </p>
                <p>
                  The public economy matters at all times. GDP, inflation, and unemployment change salary, special abilities, policy outcomes, and who can win.
                </p>
              </div>
            </div>

            <div className="rounded-[2.5rem] border-2 border-slate-800 bg-slate-900/70 p-6 sm:p-8">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-400"><ArrowRight className="h-5 w-5" /></div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Setup</p>
                  <h3 className="text-3xl font-[1000] tracking-tight text-white">Before the First Roll</h3>
                </div>
              </div>
              <div className="space-y-4 text-sm leading-relaxed text-slate-300 sm:text-base">
                <p>One player hosts a session. Everyone else joins with the session code shown in the lobby.</p>
                <p>Each class can only be taken by one player.</p>
                <p>Everyone starts with $100, plus a class-specific popularity value and voting weight.</p>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {['Host', 'Join', 'Pick Class', 'Start Fiscal Cycle'].map((step, index) => (
                  <div key={step} className="rounded-2xl border border-slate-700 bg-slate-950/70 px-3 py-4 text-center">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">0{index + 1}</div>
                    <div className="mt-2 text-sm font-black text-white">{step}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[2.5rem] border-2 border-slate-800 bg-slate-900/70 p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl bg-violet-500/15 p-3 text-violet-400"><Dice6 className="h-5 w-5" /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Turn Flow</p>
                <h3 className="text-3xl font-[1000] tracking-tight text-white">What Happens On Your Turn</h3>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
              {[
                'Roll the dice',
                'Move around the board',
                'Resolve the square you landed on',
                'Use your class action if available',
                'End your turn when all required effects are resolved',
              ].map((item, index) => (
                <div key={item} className="rounded-[1.75rem] border-2 border-slate-800 bg-slate-950/80 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Step {index + 1}</div>
                    {index < 4 && <ArrowRight className="h-4 w-4 text-slate-600 lg:hidden" />}
                  </div>
                  <p className="mt-4 text-lg font-black leading-tight text-white">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-[2.5rem] border-2 border-slate-800 bg-slate-900/70 p-6 sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-2xl bg-amber-500/15 p-3 text-amber-400"><Milestone className="h-5 w-5" /></div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Board Spaces</p>
                  <h3 className="text-3xl font-[1000] tracking-tight text-white">Squares That Matter</h3>
                </div>
              </div>

              <div className="grid gap-3">
                {RULEBOOK_SQUARES.map((square) => {
                  const Icon = square.icon;

                  return (
                    <div key={square.title} className={`rounded-[1.5rem] border-2 p-4 ${square.accent}`}>
                      <div className="flex items-start gap-4">
                        <div className="rounded-2xl bg-white/10 p-3 text-white">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-lg font-black uppercase tracking-tight text-white">{square.title}</h4>
                          <p className="mt-1 text-sm leading-relaxed text-white/75">{square.text}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[2.5rem] border-2 border-slate-800 bg-slate-900/70 p-6 sm:p-8">
                <div className="mb-6 flex items-center gap-3">
                  <div className="rounded-2xl bg-blue-500/15 p-3 text-blue-400"><UsersRound className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Class Roles</p>
                    <h3 className="text-3xl font-[1000] tracking-tight text-white">Who Does What</h3>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {RULEBOOK_CLASSES.map((entry) => (
                    <div key={entry.className} className={`rounded-[1.75rem] border-2 bg-gradient-to-br p-5 ${entry.accent}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/60">{entry.className}</p>
                          <h4 className="mt-1 text-2xl font-[1000] tracking-tight text-white">{entry.icon} {entry.className}</h4>
                        </div>
                        <div className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-widest text-white/80">
                          Class Info
                        </div>
                      </div>
                      <p className="mt-4 text-sm leading-relaxed text-white/75">{entry.summary}</p>
                      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">Win Condition</p>
                        <p className="mt-2 text-sm font-bold leading-relaxed text-white">{entry.objective}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[2.5rem] border-2 border-slate-800 bg-slate-900/70 p-6 sm:p-8">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-2xl bg-rose-500/15 p-3 text-rose-400"><Trophy className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Negotiation</p>
                    <h3 className="text-3xl font-[1000] tracking-tight text-white">Trading Votes</h3>
                  </div>
                </div>
                <div className="space-y-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                  <p>During policy votes, players can trade money, popularity, and even forced votes to influence the result.</p>
                  <p>Businessman, Banker, and Politician trade with money. The Worker trades with popularity points instead of cash.</p>
                  <p>The current player usually controls when a vote is finalized, but the vote can also resolve when time runs out.</p>
                </div>
              </div>

              <div className="rounded-[2.5rem] border-2 border-slate-800 bg-slate-900/70 p-6 sm:p-8">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-400"><Coins className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Salary & Economy</p>
                    <h3 className="text-3xl font-[1000] tracking-tight text-white">How Income Works</h3>
                  </div>
                </div>
                <div className="grid gap-3 text-sm leading-relaxed text-slate-300 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
                    <p className="font-black uppercase tracking-widest text-white">Worker</p>
                    <p className="mt-2">$30 + current minimum wage, plus extra popularity every time salary is gained.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
                    <p className="font-black uppercase tracking-widest text-white">Businessman</p>
                    <p className="mt-2">$50 + GDP × 10.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
                    <p className="font-black uppercase tracking-widest text-white">Banker</p>
                    <p className="mt-2">$50, +$50 at inflation 3, and -$20 when inflation is 7 or higher.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
                    <p className="font-black uppercase tracking-widest text-white">Politician</p>
                    <p className="mt-2">$30 + popularity × 5.</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-slate-400">
                  Taxes are applied to salary, and minimum salary rules can raise the floor for Workers.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[2.5rem] border-2 border-slate-800 bg-slate-900/70 p-6 sm:p-8">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-amber-500/15 p-3 text-amber-400"><Landmark className="h-5 w-5" /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Winning</p>
                <h3 className="text-3xl font-[1000] tracking-tight text-white">Who Wins After Year 5</h3>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {RULEBOOK_CLASSES.map((entry) => (
                <div key={`win-${entry.className}`} className="rounded-[1.75rem] border border-slate-700 bg-slate-950/80 p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">{entry.className}</p>
                  <p className="mt-3 text-sm font-bold leading-relaxed text-white">{entry.objective}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm leading-relaxed text-slate-400">
              If multiple players satisfy their conditions at the end of the game, they all appear as winners.
            </p>
          </section>

          <section className="rounded-[2.5rem] border-2 border-slate-800 bg-slate-900/70 p-6 sm:p-8">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-slate-500/20 p-3 text-slate-300"><Play className="h-5 w-5" /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Quick Start</p>
                <h3 className="text-3xl font-[1000] tracking-tight text-white">Jump In Fast</h3>
              </div>
            </div>
            <div className="grid gap-3 text-sm font-bold leading-relaxed text-slate-300 md:grid-cols-2 xl:grid-cols-4">
              {[
                'Join a lobby and pick a unique class.',
                'Share the session code with other players.',
                'Press Start Fiscal Cycle when everyone is ready.',
                'Roll, move, resolve the square, and use your class powers.',
              ].map((item, index) => (
                <div key={item} className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">0{index + 1}</div>
                  <p className="mt-2 text-white">{item}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
function PlayerInventory({ player, game, isMe, position, onLeave }: { player: Player, game: GameState | null, isMe?: boolean, position: 'bottom' | 'top' | 'left' | 'right', onLeave?: () => void }) {
  const containerClasses = {
    bottom: "flex-row w-full h-24 bg-slate-900/90 backdrop-blur-xl border-t border-slate-700 px-8 py-4 items-center justify-between",
    top: "flex-row w-full h-20 bg-slate-900/60 border-b border-slate-800 px-8 py-2 items-center justify-between",
    left: "flex-col w-24 h-full bg-slate-900/40 border-r border-slate-800 py-8 px-2 items-center",
    right: "flex-col w-24 h-full bg-slate-900/40 border-l border-slate-800 py-8 px-2 items-center",
  };

  const [showRulebook, setShowRulebook] = useState(false);
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
        return [
          `Base wage: $30`,
          `Wage bonus: +$${game.min_salary}`,
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
  const [showRulebook, setShowRulebook] = useState(false);

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

  useEffect(() => {
    if (!showRulebook) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showRulebook]);

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

        <div className="flex justify-center">
          <button
            onClick={() => setShowRulebook(true)}
            className="inline-flex w-full max-w-lg items-center justify-between gap-4 rounded-[1.75rem] border-2 border-blue-500/40 bg-blue-500/10 px-6 py-5 text-left shadow-[0_0_40px_rgba(59,130,246,0.18)] transition-all hover:border-blue-400 hover:bg-blue-500/15 sm:px-8"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-lg">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-300">Rulebook</div>
                <div className="text-xl font-[1000] uppercase tracking-tight text-white">How to Play</div>
              </div>
            </div>
            <div className="hidden items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 sm:flex">
              Open guide
              <ArrowRight className="h-4 w-4" />
            </div>
          </button>
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

      <RulebookModal isOpen={showRulebook} onClose={() => setShowRulebook(false)} />
    </div>
  );
}

export default App;
