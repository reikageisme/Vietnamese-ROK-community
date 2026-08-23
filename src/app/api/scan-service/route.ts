import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guards";
import { scanServiceError } from "@/modules/scan-service/http";
import { isPublicDataRequestsEnabled } from "@/modules/scan-service/catalog";

export async function GET() {
  if (!isPublicDataRequestsEnabled()) return new Response(null, { status: 404 });
  try {
    const session = await requireAuth();
    const [wallet, requests, topUps, transactions] = await Promise.all([
      prisma.creditWallet.findUnique({ where: { userId: session.user.id }, select: { balance: true } }),
      prisma.scanServiceRequest.findMany({ where: { requesterId: session.user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.topUpRequest.findMany({ where: { requesterId: session.user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
      prisma.creditTransaction.findMany({ where: { wallet: { userId: session.user.id } }, orderBy: { createdAt: "desc" }, take: 20 }),
    ]);
    return Response.json({ balance: wallet?.balance ?? 0, requests, topUps, transactions });
  } catch (error) {
    return scanServiceError(error);
  }
}
