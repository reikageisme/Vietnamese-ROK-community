import { afterEach, describe, expect, it } from "vitest";
import { authorizeCollector } from "./auth";
import { collectorBatchSchema } from "./schemas";

const originalToken = process.env.COLLECTOR_API_TOKEN;
afterEach(() => {
  if (originalToken === undefined) delete process.env.COLLECTOR_API_TOKEN;
  else process.env.COLLECTOR_API_TOKEN = originalToken;
});

describe("collector payload", () => {
  it("preserves large game metrics as bigint", () => {
    const parsed = collectorBatchSchema.parse({
      externalId: "phone01-kd2812-20260817",
      deviceId: "phone01",
      capturedAt: "2026-08-17T09:23:00+00:00",
      kingdom: { number: 2812, name: "Demo" },
      coveragePercent: 98,
      records: [{ governorId: "124906225", name: "Boss Võ", allianceTag: "CS35", power: "121030602", killPoints: "19378471617", deadTroops: "3650517", t5Kills: "2810034713" }],
    });
    expect(parsed.records[0].killPoints).toBe(BigInt("19378471617"));
    expect(parsed.records[0].t4Kills).toBe(BigInt(0));
  });

  it("rejects an empty scan", () => {
    const parsed = collectorBatchSchema.safeParse({ externalId: "empty-scan", deviceId: "phone01", capturedAt: "2026-08-17T09:23:00+00:00", kingdom: { number: 2812 }, coveragePercent: 0, records: [] });
    expect(parsed.success).toBe(false);
  });
});

describe("collector token", () => {
  it("accepts only the configured bearer token", () => {
    process.env.COLLECTOR_API_TOKEN = "collector-test-token-123456789";
    const valid = authorizeCollector(new Request("http://localhost", { headers: { authorization: "Bearer collector-test-token-123456789" } }));
    const invalid = authorizeCollector(new Request("http://localhost", { headers: { authorization: "Bearer wrong-token" } }));
    expect(valid.ok).toBe(true);
    expect(invalid.ok).toBe(false);
  });
});
