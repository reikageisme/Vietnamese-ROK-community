import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizeDeviceAgent, isDeviceAgentSurface } from "./auth";
import { createCharacterSchema, heartbeatSchema, rankingDocumentSchema, scanPolicySchema } from "./schemas";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("device agent boundary", () => {
  it("uses a separate long bearer token", () => {
    vi.stubEnv("DEVICE_AGENT_TOKEN", "a".repeat(32));
    expect(authorizeDeviceAgent(new Request("http://ops", { headers: { authorization: `Bearer ${"a".repeat(32)}` } })).ok).toBe(true);
    expect(authorizeDeviceAgent(new Request("http://ops", { headers: { authorization: `Bearer ${"b".repeat(32)}` } })).ok).toBe(false);
  });

  it("closes agent APIs on the public production surface", () => {
    vi.stubEnv("APP_SURFACE", "public");
    vi.stubEnv("NODE_ENV", "production");
    expect(isDeviceAgentSurface()).toBe(false);
    vi.stubEnv("APP_SURFACE", "ops");
    expect(isDeviceAgentSurface()).toBe(true);
  });
});

describe("fleet payloads", () => {
  it("accepts an 18-phone heartbeat", () => {
    const devices = Array.from({ length: 18 }, (_, index) => ({ serial: `serial-${index}`, alias: `phone${index + 1}`, status: "READY" }));
    expect(heartbeatSchema.safeParse({ agentId: "box-01", name: "Box 01", hostname: "collector", version: "0.4", devices }).success).toBe(true);
  });

  it("refuses an empty character route", () => {
    const result = createCharacterSchema.safeParse({ serial: "serial-1", key: "kd2812", label: "KD2812", kingdomNumber: 2812, switchRoute: { steps: [] } });
    expect(result.success).toBe(false);
  });

  it("raises active KvK through policy without accepting impossible cadence", () => {
    expect(scanPolicySchema.parse({ kingdomNumber: 2812, activeKvk: true, cadenceMinutes: 360 }).activeKvk).toBe(true);
    expect(scanPolicySchema.safeParse({ kingdomNumber: 2812, cadenceMinutes: 10 }).success).toBe(false);
  });

  it("accepts structured ranking output but rejects unsafe scores", () => {
    const base = { schemaVersion: 1, capturedAt: "2026-08-18T10:00:00+00:00", rankingType: "seed", target: 300 } as const;
    expect(rankingDocumentSchema.safeParse({ ...base, records: [{ rank: 1, name: "Boss Võ", score: "188686976", needsReview: false }] }).success).toBe(true);
    expect(rankingDocumentSchema.safeParse({ ...base, records: [{ rank: 1, name: "x", score: "-1", needsReview: false }] }).success).toBe(false);
  });
});
