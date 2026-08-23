import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guards";
import { scanServiceError } from "@/modules/scan-service/http";
import { creditsForTopUp } from "@/modules/scan-service/schemas";
import { isPublicDataRequestsEnabled } from "@/modules/scan-service/catalog";
import { readVnpayConfig } from "@/modules/payments/config";
import { createPaymentUrl } from "@/modules/payments/vnpay";

export const runtime = "nodejs";

const schema = z.object({ amountVnd: z.coerce.number().int().positive() });

/** VNPay cần IP thật của người mua để chấm điểm rủi ro. */
function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "127.0.0.1";
}

export async function POST(request: Request) {
  if (!isPublicDataRequestsEnabled()) return new Response(null, { status: 404 });
  try {
    const config = readVnpayConfig();
    if (!config) return Response.json({ error: "Cổng thanh toán chưa được cấu hình." }, { status: 503 });

    const session = await requireAuth();
    const { amountVnd } = schema.parse(await request.json());

    // Giá LUÔN lấy từ máy chủ. Trình duyệt chỉ được chọn gói, không được đặt giá.
    const credits = creditsForTopUp(amountVnd);
    if (!credits) return Response.json({ error: "Gói nạp không hợp lệ." }, { status: 400 });

    const txnRef = `TU${Date.now().toString(36).toUpperCase()}${randomBytes(3).toString("hex").toUpperCase()}`;

    // Ghi đơn TRƯỚC khi chuyển sang cổng. Không có dòng này thì lúc VNPay báo
    // về ta không biết đơn nào của ai, và tiền vào mà credit không vào.
    await prisma.topUpRequest.create({
      data: { requesterId: session.user.id, amountVnd, credits, transferReference: txnRef },
    });

    const paymentUrl = createPaymentUrl(config, {
      txnRef,
      amountVnd,
      orderInfo: `Nap ${credits} credit ROK FAQ`,
      ipAddress: clientIp(request),
      createdAt: new Date(),
    });

    return Response.json({ paymentUrl, txnRef });
  } catch (error) {
    return scanServiceError(error);
  }
}
