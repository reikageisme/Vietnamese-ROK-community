import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-guards";
import { isOpsSurface } from "@/modules/scan-service/catalog";
import { scanServiceError } from "@/modules/scan-service/http";
import { reviewTopUpSchema } from "@/modules/scan-service/schemas";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isOpsSurface()) return new Response(null, { status: 404 });
  try {
    const session = await requireAuth();
    requireRole(session, ["MODERATOR", "ADMIN"]);
    const { id } = await context.params;
    const input = reviewTopUpSchema.parse(await request.json());
    const result = await prisma.$transaction(async (tx) => {
      const pending = await tx.topUpRequest.findFirst({ where: { id, status: "PENDING" } });
      if (!pending) return null;
      const claimed = await tx.topUpRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: input.decision, reviewerId: session.user.id, reviewerNote: input.note || null, reviewedAt: new Date() },
      });
      if (!claimed.count) return null;
      if (input.decision === "REJECTED") {
        return tx.topUpRequest.findUniqueOrThrow({ where: { id } });
      }
      const wallet = await tx.creditWallet.upsert({ where: { userId: pending.requesterId }, create: { userId: pending.requesterId }, update: {} });
      const updatedWallet = await tx.creditWallet.update({ where: { id: wallet.id }, data: { balance: { increment: pending.credits } } });
      await tx.creditTransaction.create({ data: { walletId: wallet.id, actorId: session.user.id, kind: "TOP_UP", amount: pending.credits, balanceAfter: updatedWallet.balance, reference: `topup:${id}` } });
      return tx.topUpRequest.findUniqueOrThrow({ where: { id } });
    });
    if (!result) return Response.json({ error: "Phiếu nạp không còn ở trạng thái chờ duyệt." }, { status: 409 });
    return Response.json({ topUp: result });
  } catch (error) {
    return scanServiceError(error);
  }
}
