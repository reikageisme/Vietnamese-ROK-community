import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-guards";
import { isOpsSurface } from "@/modules/scan-service/catalog";
import { scanServiceError } from "@/modules/scan-service/http";
import { updateScanStatusSchema } from "@/modules/scan-service/schemas";

const transitions = {
  QUEUED: ["ASSIGNED", "CANCELLED", "REFUNDED"],
  ASSIGNED: ["RUNNING", "CANCELLED", "REFUNDED"],
  RUNNING: ["REVIEWING", "CANCELLED", "REFUNDED"],
  REVIEWING: ["COMPLETED", "RUNNING", "REFUNDED"],
  COMPLETED: [],
  CANCELLED: ["REFUNDED"],
  REFUNDED: [],
} as const;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isOpsSurface()) return new Response(null, { status: 404 });
  try {
    const session = await requireAuth();
    requireRole(session, ["MODERATOR", "ADMIN"]);
    const { id } = await context.params;
    const input = updateScanStatusSchema.parse(await request.json());
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.scanServiceRequest.findUnique({ where: { id } });
      if (!current) return { missing: true } as const;
      const allowed = transitions[current.status] as readonly string[];
      if (!allowed.includes(input.status)) return { conflict: true } as const;
      const claimed = await tx.scanServiceRequest.updateMany({
        where: { id, status: current.status },
        data: { status: input.status, assignedDeviceId: input.assignedDeviceId || current.assignedDeviceId, completedAt: input.status === "COMPLETED" ? new Date() : current.completedAt },
      });
      if (!claimed.count) return { conflict: true } as const;
      if (input.status === "REFUNDED") {
        const wallet = await tx.creditWallet.upsert({ where: { userId: current.requesterId }, create: { userId: current.requesterId }, update: {} });
        const updatedWallet = await tx.creditWallet.update({ where: { id: wallet.id }, data: { balance: { increment: current.costCredits } } });
        await tx.creditTransaction.create({ data: { walletId: wallet.id, actorId: session.user.id, kind: "REFUND", amount: current.costCredits, balanceAfter: updatedWallet.balance, reference: current.requestCode } });
      }
      const updated = await tx.scanServiceRequest.findUniqueOrThrow({ where: { id } });
      return { request: updated } as const;
    });
    if ("missing" in result) return Response.json({ error: "Không tìm thấy đơn quét." }, { status: 404 });
    if ("conflict" in result) return Response.json({ error: "Không thể chuyển sang trạng thái này." }, { status: 409 });
    return Response.json(result);
  } catch (error) {
    return scanServiceError(error);
  }
}
