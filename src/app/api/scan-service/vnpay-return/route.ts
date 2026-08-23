import { NextResponse } from "next/server";
import { TopUpStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readVnpayConfig } from "@/modules/payments/config";
import { verifyReturn } from "@/modules/payments/vnpay";

export const runtime = "nodejs";

/** VNPay chuyển người dùng về đây sau khi thanh toán.
 *
 * Đây là đường NGƯỜI DÙNG đi, không phải nguồn sự thật về tiền — trình duyệt có
 * thể đóng giữa chừng, hoặc người dùng tự gõ tham số. Nguồn sự thật là IPN mà
 * VNPay gọi từ máy chủ của họ. Ở đây ta vẫn kiểm chữ ký rồi mới cộng credit, và
 * cộng theo kiểu idempotent để IPN gọi lại cũng không cộng hai lần.
 */
export async function GET(request: Request) {
  const config = readVnpayConfig();
  if (!config) return NextResponse.redirect(new URL("/scans?payment=unavailable", request.url));

  const query = Object.fromEntries(new URL(request.url).searchParams.entries());
  const result = verifyReturn(query, config.hashSecret);
  if (!result.ok) return NextResponse.redirect(new URL("/scans?payment=invalid", request.url));

  const topUp = await prisma.topUpRequest.findFirst({
    where: { transferReference: result.txnRef },
    select: { id: true, status: true, amountVnd: true, credits: true, requesterId: true },
  });
  if (!topUp) return NextResponse.redirect(new URL("/scans?payment=unknown", request.url));

  // Số tiền VNPay báo phải khớp đơn đã ghi. Lệch là dấu hiệu bị can thiệp.
  if (topUp.amountVnd !== result.amountVnd) {
    return NextResponse.redirect(new URL("/scans?payment=mismatch", request.url));
  }
  if (!result.succeeded) {
    if (topUp.status === TopUpStatus.PENDING) {
      await prisma.topUpRequest.update({
        where: { id: topUp.id },
        data: { status: TopUpStatus.REJECTED, reviewerNote: `VNPay ${result.responseCode}` },
      });
    }
    return NextResponse.redirect(new URL("/scans?payment=failed", request.url));
  }
  // Đã cộng rồi thì thôi — người dùng bấm F5 cũng không cộng thêm lần nữa.
  if (topUp.status === TopUpStatus.APPROVED) {
    return NextResponse.redirect(new URL("/scans?payment=success", request.url));
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.topUpRequest.updateMany({
      where: { id: topUp.id, status: TopUpStatus.PENDING },
      data: { status: TopUpStatus.APPROVED, reviewedAt: new Date() },
    });
    // updateMany trả về 0 nghĩa là một tiến trình khác vừa duyệt xong đơn này.
    // Dừng lại, đừng cộng credit lần thứ hai.
    if (updated.count === 0) return;
    await tx.creditWallet.upsert({
      where: { userId: topUp.requesterId },
      update: { balance: { increment: topUp.credits } },
      create: { userId: topUp.requesterId, balance: topUp.credits },
    });
  });

  return NextResponse.redirect(new URL("/scans?payment=success", request.url));
}
