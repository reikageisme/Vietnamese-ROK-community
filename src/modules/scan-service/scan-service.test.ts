import { afterEach, describe, expect, it } from "vitest";
import { isOpsSurface, scanCatalog, topUpCatalog } from "./catalog";
import { createScanRequestSchema, createTopUpSchema, creditsForProduct, creditsForTopUp } from "./schemas";

const originalSurface = process.env.APP_SURFACE;
afterEach(() => { process.env.APP_SURFACE = originalSurface; });

describe("scan service catalog", () => {
  it("uses server-side prices for every product", () => {
    expect(creditsForProduct("KINGDOM_OVERVIEW")).toBe(50);
    expect(creditsForProduct("GOVERNOR_TOP_300")).toBe(120);
    expect(creditsForProduct("KVK_CAMP")).toBe(250);
    expect(Object.keys(scanCatalog)).toHaveLength(3);
  });

  it("accepts only configured top-up packages", () => {
    expect(creditsForTopUp(100_000)).toBe(110);
    expect(creditsForTopUp(99_000)).toBeNull();
    expect(createTopUpSchema.safeParse({ amountVnd: 99_000, transferReference: "FT1234" }).success).toBe(false);
    expect(topUpCatalog).toHaveLength(3);
  });

  it("validates kingdom and product without accepting a client price", () => {
    const parsed = createScanRequestSchema.parse({ kingdomNumber: "2812", product: "KINGDOM_OVERVIEW", costCredits: 1 });
    expect(parsed.kingdomNumber).toBe(2812);
    expect("costCredits" in parsed).toBe(false);
    expect(createScanRequestSchema.safeParse({ kingdomNumber: 10000, product: "KINGDOM_OVERVIEW" }).success).toBe(false);
  });
});

describe("ops surface", () => {
  it("is closed unless the process is explicitly the ops app", () => {
    process.env.APP_SURFACE = "public";
    expect(isOpsSurface()).toBe(false);
    process.env.APP_SURFACE = "ops";
    expect(isOpsSurface()).toBe(true);
  });
});
