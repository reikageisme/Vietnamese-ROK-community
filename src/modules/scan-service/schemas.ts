import { z } from "zod";
import { scanCatalog, topUpCatalog } from "./catalog";

export const createScanRequestSchema = z.object({
  kingdomNumber: z.coerce.number().int().min(1).max(9999),
  product: z.enum(["KINGDOM_OVERVIEW", "GOVERNOR_TOP_300", "KVK_CAMP"]),
  note: z.string().trim().max(500).optional(),
});

export const createTopUpSchema = z.object({
  amountVnd: z.coerce.number().int(),
  transferReference: z.string().trim().min(4).max(100),
}).superRefine((input, context) => {
  if (!topUpCatalog.some((item) => item.amountVnd === input.amountVnd)) {
    context.addIssue({ code: "custom", path: ["amountVnd"], message: "Gói nạp không hợp lệ" });
  }
});

export const reviewTopUpSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(500).optional(),
});

export const updateScanStatusSchema = z.object({
  status: z.enum(["ASSIGNED", "RUNNING", "REVIEWING", "COMPLETED", "CANCELLED", "REFUNDED"]),
  assignedDeviceId: z.string().trim().max(100).optional(),
});

export function creditsForProduct(product: keyof typeof scanCatalog) {
  return scanCatalog[product].credits;
}

export function creditsForTopUp(amountVnd: number) {
  return topUpCatalog.find((item) => item.amountVnd === amountVnd)?.credits ?? null;
}
