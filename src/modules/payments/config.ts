import type { VnpayConfig } from "./vnpay";

/** Đọc cấu hình VNPay từ biến môi trường.
 *
 * Tách riêng khỏi `vnpay.ts` để phần tính toán chữ ký vẫn là hàm thuần, test
 * được mà không cần dựng môi trường.
 */
export function readVnpayConfig(): VnpayConfig | null {
  const tmnCode = process.env.VNPAY_TMN_CODE;
  const hashSecret = process.env.VNPAY_HASH_SECRET;
  const payUrl = process.env.VNPAY_PAY_URL;
  const returnUrl = process.env.VNPAY_RETURN_URL;
  // Thiếu một mảnh là coi như chưa bật. Không tự đoán giá trị mặc định cho
  // thứ liên quan tới tiền.
  if (!tmnCode || !hashSecret || !payUrl || !returnUrl) return null;
  return { tmnCode, hashSecret, payUrl, returnUrl };
}

export function isVnpayEnabled(): boolean {
  return readVnpayConfig() !== null;
}
