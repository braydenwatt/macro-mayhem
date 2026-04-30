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
      break;
    case 'Businessman':
      salary = 50 + (gdp * 10); // Adaptive: Scaled by GDP
      break;
    case 'Banker':
      salary = 50;
      if (inflation === 3) salary += 50; // Bonus for perfect stability
      if (inflation > 7) salary -= 20; // Penalty for hyperinflation
      break;
    case 'Politician':
      salary = 30 + (popularity * 5); // Adaptive: Scaled by popularity
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
      // Adaptive: Bonus for low unemployment
      break;
    case 'Businessman':
      baseSalary = 50 + (gdp * 10); // Adaptive: Scaled by GDP
      break;
    case 'Banker':
      baseSalary = 50;
      if (inflation === 3) baseSalary += 50; // Bonus for perfect stability
      if (inflation > 7) baseSalary -= 20; // Penalty for hyperinflation
      break;
    case 'Politician':
      baseSalary = 30 + (popularity * 5); // Adaptive: Scaled by popularity
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
  return currentBalance + delta;
};
