import { z } from "zod";

const bigintMetric = z.union([
  z.string().regex(/^\d+$/, "Metric phải là chuỗi số nguyên không âm."),
  z.number().int().nonnegative().safe(),
]).transform((value) => BigInt(value));

export const collectorGovernorSchema = z.object({
  governorId: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(120),
  allianceTag: z.string().trim().max(16).optional().default(""),
  allianceName: z.string().trim().max(120).optional(),
  power: bigintMetric,
  killPoints: bigintMetric,
  deadTroops: bigintMetric,
  t1Kills: bigintMetric.optional().default(BigInt(0)),
  t2Kills: bigintMetric.optional().default(BigInt(0)),
  t3Kills: bigintMetric.optional().default(BigInt(0)),
  t4Kills: bigintMetric.optional().default(BigInt(0)),
  t5Kills: bigintMetric.optional().default(BigInt(0)),
  rangedPoints: bigintMetric.optional().default(BigInt(0)),
  resourcesGathered: bigintMetric.optional().default(BigInt(0)),
  helps: bigintMetric.optional().default(BigInt(0)),
});

export const collectorBatchSchema = z.object({
  externalId: z.string().trim().min(8).max(191),
  deviceId: z.string().trim().min(1).max(100),
  capturedAt: z.iso.datetime({ offset: true }),
  kingdom: z.object({
    number: z.number().int().min(1).max(99_999),
    name: z.string().trim().max(120).optional(),
  }),
  coveragePercent: z.number().int().min(0).max(100),
  evidenceObjectKeys: z.array(z.string().trim().min(1).max(512)).max(2_000).optional().default([]),
  records: z.array(collectorGovernorSchema).min(1).max(500),
});

export type CollectorBatchInput = z.infer<typeof collectorBatchSchema>;
