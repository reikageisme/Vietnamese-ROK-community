export type DurationParts = {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
};

export function durationToSeconds(parts: DurationParts): number {
  const values = [parts.days, parts.hours, parts.minutes, parts.seconds];
  if (values.some((value) => value !== undefined && (!Number.isFinite(value) || value < 0))) {
    throw new Error("INVALID_DURATION");
  }

  return Math.round(
    (parts.days ?? 0) * 86_400 +
      (parts.hours ?? 0) * 3_600 +
      (parts.minutes ?? 0) * 60 +
      (parts.seconds ?? 0),
  );
}

export function secondsToDuration(totalSeconds: number): Required<DurationParts> {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    throw new Error("INVALID_DURATION");
  }

  let remaining = Math.round(totalSeconds);
  const days = Math.floor(remaining / 86_400);
  remaining %= 86_400;
  const hours = Math.floor(remaining / 3_600);
  remaining %= 3_600;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return { days, hours, minutes, seconds };
}

export function calculateSpeedup(input: {
  target: DurationParts;
  available: DurationParts;
}) {
  const targetSeconds = durationToSeconds(input.target);
  const availableSeconds = durationToSeconds(input.available);
  const remainingSeconds = Math.max(0, targetSeconds - availableSeconds);
  return {
    targetSeconds,
    availableSeconds,
    remainingSeconds,
    remaining: secondsToDuration(remainingSeconds),
    covered: availableSeconds >= targetSeconds,
  };
}

export type Resources = {
  food: number;
  wood: number;
  stone: number;
  gold: number;
};

const resourceKeys: (keyof Resources)[] = ["food", "wood", "stone", "gold"];

function validateResources(resources: Resources) {
  if (resourceKeys.some((key) => !Number.isFinite(resources[key]) || resources[key] < 0)) {
    throw new Error("INVALID_RESOURCE_VALUE");
  }
}

export function calculateResourceGap(input: { required: Resources; owned: Resources }) {
  validateResources(input.required);
  validateResources(input.owned);
  const missing = Object.fromEntries(
    resourceKeys.map((key) => [key, Math.max(0, input.required[key] - input.owned[key])]),
  ) as Resources;
  return {
    missing,
    totalMissing: resourceKeys.reduce((total, key) => total + missing[key], 0),
    covered: resourceKeys.every((key) => missing[key] === 0),
  };
}

export function calculateHealing(input: {
  units: number;
  costPerUnit: Resources;
  secondsPerUnit: number;
  costReductionPercent?: number;
  speedBonusPercent?: number;
}) {
  if (!Number.isInteger(input.units) || input.units < 0) throw new Error("INVALID_UNIT_COUNT");
  validateResources(input.costPerUnit);
  if (!Number.isFinite(input.secondsPerUnit) || input.secondsPerUnit < 0) throw new Error("INVALID_TIME");
  const costMultiplier = 1 - Math.min(100, Math.max(0, input.costReductionPercent ?? 0)) / 100;
  const speedMultiplier = 1 + Math.max(0, input.speedBonusPercent ?? 0) / 100;
  const cost = Object.fromEntries(
    resourceKeys.map((key) => [key, Math.ceil(input.units * input.costPerUnit[key] * costMultiplier)]),
  ) as Resources;
  const totalSeconds = Math.ceil((input.units * input.secondsPerUnit) / speedMultiplier);
  return { units: input.units, cost, totalSeconds, duration: secondsToDuration(totalSeconds) };
}

export function calculateCommanderSculptures(input: {
  currentSkillLevel: number;
  targetSkillLevel: number;
  cumulativeCosts: number[];
  ownedSculptures?: number;
}) {
  const { currentSkillLevel, targetSkillLevel, cumulativeCosts } = input;
  if (
    !Number.isInteger(currentSkillLevel) ||
    !Number.isInteger(targetSkillLevel) ||
    currentSkillLevel < 1 ||
    targetSkillLevel < currentSkillLevel ||
    targetSkillLevel > cumulativeCosts.length
  ) throw new Error("INVALID_SKILL_LEVEL");
  if (cumulativeCosts.some((value, index) => value < 0 || (index > 0 && value < cumulativeCosts[index - 1]))) {
    throw new Error("INVALID_COST_TABLE");
  }
  const required = cumulativeCosts[targetSkillLevel - 1] - cumulativeCosts[currentSkillLevel - 1];
  return { required, missing: Math.max(0, required - (input.ownedSculptures ?? 0)) };
}

export function calculateCrafting(input: {
  required: Record<string, number>;
  inventory: Record<string, number>;
}) {
  const materialNames = new Set([...Object.keys(input.required), ...Object.keys(input.inventory)]);
  const missing: Record<string, number> = {};
  for (const name of materialNames) {
    const required = input.required[name] ?? 0;
    const owned = input.inventory[name] ?? 0;
    if (!Number.isFinite(required) || required < 0 || !Number.isFinite(owned) || owned < 0) {
      throw new Error("INVALID_MATERIAL_VALUE");
    }
    missing[name] = Math.max(0, required - owned);
  }
  return { missing, craftable: Object.values(missing).every((value) => value === 0) };
}

export function calculateMigrationPassports(input: {
  requiredPassports: number;
  ownedPassports: number;
  individualCredits: number;
  creditsPerPassport: number;
}) {
  const values = Object.values(input);
  if (values.some((value) => !Number.isFinite(value) || value < 0) || input.creditsPerPassport <= 0) {
    throw new Error("INVALID_MIGRATION_INPUT");
  }
  const missingPassports = Math.max(0, Math.ceil(input.requiredPassports) - Math.floor(input.ownedPassports));
  const purchasable = Math.floor(input.individualCredits / input.creditsPerPassport);
  return {
    missingPassports,
    purchasable,
    creditsNeeded: Math.max(0, missingPassports * input.creditsPerPassport - input.individualCredits),
    ready: purchasable >= missingPassports,
  };
}
