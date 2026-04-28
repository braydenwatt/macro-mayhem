import { PlayerClass } from '../types/game';

export const CAP_MIN = 1;
export const CAP_MAX = 10;

export const clampLevel = (val: number): number => {
  return Math.max(CAP_MIN, Math.min(CAP_MAX, val));
};

export const calculateSalary = (
  playerClass: PlayerClass, 
  gdp: number, 
  inflation: number, 
  unemployment: number,
  popularity: number,
  taxRate: number = 20,
  minSalary: number = 0
): number => {
  let salary = 50; // Default Base Salary (10x scaled)

  switch (playerClass) {
    case 'Worker':
      salary = 30 + minSalary; // Special base for Worker (Increments with min wage)
      if (unemployment <= 2) salary += 30; // 10x bonus
      break;
    case 'Businessman':
      salary = 100; // Special base for Businessman
      if (gdp >= 4) salary += 50; // 10x bonus
      break;
    case 'Banker':
      if (inflation === 3) salary += 40; // 10x bonus
      break;
    case 'Politician':
      if (popularity >= 6) salary += 20; // 10x bonus
      break;
  }

  // Apply Taxation
  const afterTax = Math.floor(salary * (1 - taxRate / 100));
  
  // Apply Minimum Salary Floor
  return Math.max(minSalary, afterTax);
};

export const getSalaryDetails = (
  playerClass: PlayerClass, 
  gdp: number, 
  inflation: number, 
  unemployment: number,
  popularity: number,
  taxRate: number = 20,
  minSalary: number = 0
) => {
  let baseSalary = 50;

  switch (playerClass) {
    case 'Worker':
      baseSalary = 30 + minSalary; // Special base for Worker (Increments with min wage)
      if (unemployment <= 2) baseSalary += 30;
      break;
    case 'Businessman':
      baseSalary = 100;
      if (gdp >= 4) baseSalary += 50;
      break;
    case 'Banker':
      if (inflation === 3) baseSalary += 40;
      break;
    case 'Politician':
      if (popularity >= 6) baseSalary += 20;
      break;
  }

  const taxAmount = Math.floor(baseSalary * (taxRate / 100));
  const afterTax = baseSalary - taxAmount;
  const finalSalary = Math.max(minSalary, afterTax);

  return { baseSalary, taxAmount, finalSalary };
};

export const calculateSalaryPayout = (
  baseSalary: number,
  isLanding: boolean
): number => {
  const multiplier = isLanding ? 1.2 : 1.0;
  return Math.floor(baseSalary * multiplier);
};

export const applyMoneyDelta = (currentBalance: number, delta: number): number => {
  const newBalance = currentBalance + delta;
  return Math.max(0, newBalance); // Crippling Debt: cannot go below 0
};
