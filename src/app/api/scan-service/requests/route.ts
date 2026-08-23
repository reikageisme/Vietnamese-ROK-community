import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guards";
import { InsufficientCreditsError, scanServiceError } from "@/modules/scan-service/http";
import { createScanRequestSchema, creditsForProduct } from "@/modules/scan-service/schemas";
import { isPublicDataRequestsEnabled } from "@/modules/scan-service/catalog";

export async function POST(request: Request) {
  if (!isPublicDataRequestsEnabled()) return new Response(null, { status: 404 });
  try {
    const session = await requireAuth();
    const input = createScanRequestSchema.parse(await request.json());
    const cost = creditsForProduct(input.product);
    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.creditWallet.upsert({ where: { userId: session.user.id }, create: { userId: session.user.id }, update: {} });
      const debit = await tx.creditWallet.updateMany({ where: { id: wallet.id, balance: { gte: cost } }, data: { balance: { decrement: cost } } });
      if (!debit.count) throw new InsufficientCreditsError();
      const updatedWallet = await tx.creditWallet.findUniqueOrThrow({ where: { id: wallet.id } });
      const created = await tx.scanServiceRequest.create({
        data: {
          requestCode: `RV-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${randomUUID().slice(0, 6).toUpperCase()}`,
          requesterId: session.user.id,
          kingdomNumber: input.kingdomNumber,
          product: input.product,
          costCredits: cost,
          note: input.note || null,
        },
      });
      await tx.kingdom.upsert({ where: { number: input.kingdomNumber }, create: { number: input.kingdomNumber }, update: {} });
      await tx.automationJob.create({
        data: {
          type: input.product === "GOVERNOR_TOP_300" ? "KINGDOM_FULL" : input.product === "KVK_CAMP" ? "KVK_DISCOVERY" : "RANKING_SEED",
          kingdomNumber: input.kingdomNumber,
          amount: 300,
          priority: input.product === "KVK_CAMP" ? 1_000 : 500,
          scanName: created.requestCode.toLowerCase(),
          serviceRequestId: created.id,
        },
      });
      await tx.creditTransaction.create({ data: { walletId: wallet.id, actorId: session.user.id, kind: "SCAN_CHARGE", amount: -cost, balanceAfter: updatedWallet.balance, reference: created.requestCode } });
      return { request: created, balance: updatedWallet.balance };
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return scanServiceError(error);
  }
}
