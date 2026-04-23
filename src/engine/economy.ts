import { PlayerClass } from '../types/game';

export const CAP_MIN = 1;
export const CAP_MAX = 5;

export const clampLevel = (val: number): number => {
  return Math.max(CAP_MIN, Math.min(CAP_MAX, val));
};

export const calculateSalary = (
  playerClass: PlayerClass, 
  gdp: number, 
  inflation: number, 
  unemployment: number,
  popularity: number
): number => {
  let salary = 5; // Base Salary

  switch (playerClass) {
    case 'Worker':
      if (unemployment <= 2) salary += 3;
      break;
    case 'Businessman':
      if (gdp >= 4) salary += 5;
      break;
    case 'Banker':
      if (inflation === 3) salary += 4;
      break;
    case 'Politician':
      if (popularity >= 6) salary += 2;
      break;
  }

  return salary;
};

export const applyMoneyDelta = (currentBalance: number, delta: number): number => {
  const newBalance = currentBalance + delta;
  return Math.max(0, newBalance); // Crippling Debt: cannot go below 0
};
