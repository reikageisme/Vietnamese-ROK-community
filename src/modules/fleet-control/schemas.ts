import { z } from "zod";

const deviceStatus = z.enum(["READY", "BUSY", "OFFLINE", "ERROR", "DISABLED"]);

export const heartbeatSchema = z.object({
  agentId: z.string().trim().min(2).max(100),
  name: z.string().trim().min(2).max(120),
  hostname: z.string().trim().min(1).max(191),
  version: z.string().trim().min(1).max(40),
  capabilities: z.record(z.string(), z.unknown()).optional(),
  error: z.string().max(2_000).nullable().optional(),
  devices: z.array(z.object({
    serial: z.string().trim().min(1).max(100),
    alias: z.string().trim().min(1).max(80),
    model: z.string().trim().max(120).nullable().optional(),
    adbState: z.string().trim().max(40).nullable().optional(),
    resolution: z.string().trim().max(40).nullable().optional(),
    batteryPercent: z.number().int().min(0).max(100).nullable().optional(),
    status: deviceStatus,
    currentCharacterKey: z.string().trim().max(100).nullable().optional(),
    error: z.string().max(2_000).nullable().optional(),
  })).max(64),
});

export const claimJobSchema = z.object({
  agentId: z.string().trim().min(2).max(100),
  serial: z.string().trim().min(1).max(100),
});

export const jobEventSchema = z.object({
  agentId: z.string().trim().min(2).max(100),
  serial: z.string().trim().min(1).max(100),
  status: z.enum(["SWITCHING", "SCANNING", "UPLOADING", "REVIEWING", "COMPLETED", "FAILED"]),
  progress: z.record(z.string(), z.unknown()).optional(),
  result: z.record(z.string(), z.unknown()).optional(),
  error: z.string().max(8_000).nullable().optional(),
  collectorBatchId: z.string().trim().max(191).optional(),
});

const rankingScoreSchema = z.union([
  z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  z.string().trim().regex(/^\d{1,20}$/),
]).nullable();

export const rankingDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  capturedAt: z.iso.datetime({ offset: true }),
  rankingType: z.enum(["seed", "alliance", "honor"]),
  target: z.number().int().min(1).max(500),
  records: z.array(z.object({
    rank: z.number().int().min(1).max(10_000),
    name: z.string().trim().max(160).nullable().optional(),
    score: rankingScoreSchema,
    needsReview: z.boolean().default(false),
  })).max(500),
});

const automationRouteSchema = z.object({
  steps: z.array(z.discriminatedUnion("action", [
    z.object({ action: z.literal("tap"), point: z.string().min(1).max(100), waitSeconds: z.number().min(0).max(30).default(1) }),
    z.object({ action: z.literal("swipe"), from: z.string().min(1).max(100), to: z.string().min(1).max(100), durationMs: z.number().int().min(100).max(5_000).default(650), waitSeconds: z.number().min(0).max(30).default(1) }),
    z.object({ action: z.literal("keyevent"), key: z.string().regex(/^KEYCODE_[A-Z0-9_]+$/), waitSeconds: z.number().min(0).max(30).default(1) }),
    z.object({ action: z.literal("wait-screen"), screen: z.string().min(1).max(100), timeoutSeconds: z.number().min(1).max(60).default(15) }),
  ])).min(1).max(40),
  finalScreen: z.string().min(1).max(100).optional(),
});

export const createCharacterSchema = z.object({
  serial: z.string().trim().min(1).max(100),
  key: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(120),
  accountLabel: z.string().trim().max(120).optional(),
  governorId: z.string().trim().max(32).optional(),
  kingdomNumber: z.coerce.number().int().min(1000).max(9999),
  switchOrder: z.coerce.number().int().min(0).max(999).default(0),
  switchRoute: automationRouteSchema,
  scanRoutes: z.object({
    KINGDOM_FULL: automationRouteSchema.optional(),
    RANKING_SEED: automationRouteSchema.optional(),
    RANKING_ALLIANCE: automationRouteSchema.optional(),
    RANKING_HONOR: automationRouteSchema.optional(),
    KVK_DISCOVERY: automationRouteSchema.optional(),
  }).default({}),
});

export const createAutomationJobSchema = z.object({
  type: z.enum(["KINGDOM_FULL", "RANKING_SEED", "RANKING_ALLIANCE", "RANKING_HONOR", "KVK_DISCOVERY"]),
  kingdomNumber: z.coerce.number().int().min(1000).max(9999),
  amount: z.coerce.number().int().min(1).max(500).default(300),
  priority: z.coerce.number().int().min(0).max(10_000).default(100),
  scanName: z.string().trim().min(1).max(120),
  serial: z.string().trim().max(100).optional(),
  scheduledAt: z.iso.datetime({ offset: true }).optional(),
});

export const scanPolicySchema = z.object({
  kingdomNumber: z.coerce.number().int().min(1000).max(9999),
  enabled: z.boolean().default(true),
  fullScan: z.boolean().default(false),
  amount: z.coerce.number().int().min(1).max(500).default(300),
  cadenceMinutes: z.coerce.number().int().min(60).max(525_600).default(10_080),
  priority: z.coerce.number().int().min(0).max(10_000).default(100),
  activeKvk: z.boolean().default(false),
  reason: z.string().trim().max(191).optional(),
});
