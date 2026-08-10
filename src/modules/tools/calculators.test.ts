import { describe, expect, it } from "vitest";

import {
  calculateMigrationPassports,
  calculateResourceGap,
  calculateSpeedup,
  secondsToDuration,
} from "./calculators";

describe("tool calculators", () => {
  it("calculates the uncovered speedup duration", () => {
    expect(
      calculateSpeedup({
        target: { days: 2, hours: 4 },
        available: { days: 1, hours: 6 },
      }),
    ).toMatchObject({
      covered: false,
      remaining: { days: 0, hours: 22, minutes: 0, seconds: 0 },
    });
  });

  it("normalizes seconds", () => {
    expect(secondsToDuration(90_061)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1 });
  });

  it("never returns negative missing resources", () => {
    const result = calculateResourceGap({
      required: { food: 100, wood: 100, stone: 50, gold: 20 },
      owned: { food: 120, wood: 60, stone: 50, gold: 0 },
    });
    expect(result.missing).toEqual({ food: 0, wood: 40, stone: 0, gold: 20 });
  });

  it("calculates passport credit gap without game automation", () => {
    expect(
      calculateMigrationPassports({
        requiredPassports: 4,
        ownedPassports: 1,
        individualCredits: 1_200,
        creditsPerPassport: 600,
      }),
    ).toEqual({ missingPassports: 3, purchasable: 2, creditsNeeded: 600, ready: false });
  });
});
