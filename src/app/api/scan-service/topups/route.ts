import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guards";
import { scanServiceError } from "@/modules/scan-service/http";
import { createTopUpSchema, creditsForTopUp } from "@/modules/scan-service/schemas";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const input = createTopUpSchema.parse(await request.json());
    const credits = creditsForTopUp(input.amountVnd);
    if (!credits) return Response.json({ error: "Gói nạp không hợp lệ." }, { status: 400 });
    const duplicate = await prisma.topUpRequest.findUnique({ where: { requesterId_transferReference: { requesterId: session.user.id, transferReference: input.transferReference } }, select: { id: true } });
    if (duplicate) return Response.json({ error: "Mã giao dịch này đã được sử dụng." }, { status: 409 });
    const topUp = await prisma.topUpRequest.create({ data: { requesterId: session.user.id, amountVnd: input.amountVnd, credits, transferReference: input.transferReference } });
    return Response.json({ topUp }, { status: 201 });
  } catch (error) {
    return scanServiceError(error);
  }
}
