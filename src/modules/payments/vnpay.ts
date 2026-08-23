import { createHmac, timingSafeEqual } from "node:crypto";

/** Ký và kiểm chứng giao dịch VNPay (cổng thanh toán 2.1.0).
 *
 * Toàn bộ phần tính toán nằm ở đây dưới dạng hàm thuần: không đọc biến môi
 * trường, không gọi mạng, không đụng cơ sở dữ liệu. Tiền bạc là chỗ không được
 * phép "chắc là đúng" — phải test được, và test được thì phải tách ra.
 *
 * Điều quan trọng nhất về chữ ký VNPay: nó được tính trên chuỗi truy vấn ĐÃ
 * SẮP XẾP theo tên tham số và ĐÃ mã hoá URL. Sai thứ tự hoặc sai cách mã hoá
 * thì cổng trả về lỗi chữ ký, mà thông báo lỗi không nói cho bạn biết sai ở đâu.
 */

export type VnpayConfig = {
  /** Mã website do VNPay cấp. */
  tmnCode: string;
  /** Chuỗi bí mật để ký. KHÔNG BAO GIỜ được gửi ra trình duyệt. */
  hashSecret: string;
  /** Ví dụ: https://sandbox.vnpayment.vn/paymentv2/vpcpay.html */
  payUrl: string;
  returnUrl: string;
};

export type CreatePaymentInput = {
  /** Mã đơn của mình, duy nhất. VNPay dùng nó để chống trùng. */
  txnRef: string;
  /** Số tiền VND, số nguyên. Không nhân 100 ở đây — hàm này tự làm. */
  amountVnd: number;
  orderInfo: string;
  ipAddress: string;
  /** Thời điểm tạo đơn. Truyền vào để test được, không gọi Date.now() bên trong. */
  createdAt: Date;
  /** Số phút đơn còn hiệu lực. */
  expireMinutes?: number;
  locale?: "vn" | "en";
  orderType?: string;
};

/** VNPay yêu cầu dấu thời gian theo giờ Việt Nam, định dạng yyyyMMddHHmmss. */
export function formatVnpayTime(date: Date): string {
  const vietnam = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${vietnam.getUTCFullYear()}${pad(vietnam.getUTCMonth() + 1)}${pad(vietnam.getUTCDate())}` +
    `${pad(vietnam.getUTCHours())}${pad(vietnam.getUTCMinutes())}${pad(vietnam.getUTCSeconds())}`
  );
}

/** Mã hoá theo đúng kiểu VNPay: encodeURIComponent rồi đổi %20 thành dấu cộng. */
function encodeValue(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

/** Chuỗi ký: sắp xếp theo tên tham số, nối `key=value` bằng dấu &. */
export function buildSignData(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((key) => params[key] !== "" && params[key] !== undefined)
    .sort()
    .map((key) => `${encodeValue(key)}=${encodeValue(params[key])}`)
    .join("&");
}

export function sign(params: Record<string, string>, hashSecret: string): string {
  return createHmac("sha512", hashSecret).update(buildSignData(params), "utf8").digest("hex");
}

/** Tạo liên kết chuyển hướng sang cổng VNPay. */
export function createPaymentUrl(config: VnpayConfig, input: CreatePaymentInput): string {
  if (!Number.isInteger(input.amountVnd) || input.amountVnd <= 0) {
    throw new Error("Số tiền phải là số nguyên dương.");
  }
  const expire = new Date(input.createdAt.getTime() + (input.expireMinutes ?? 15) * 60 * 1000);

  const params: Record<string, string> = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: config.tmnCode,
    // VNPay tính bằng đơn vị nhỏ nhất: nhân 100. Quên chỗ này là thu sai gấp 100 lần.
    vnp_Amount: String(input.amountVnd * 100),
    vnp_CurrCode: "VND",
    vnp_TxnRef: input.txnRef,
    vnp_OrderInfo: input.orderInfo,
    vnp_OrderType: input.orderType ?? "other",
    vnp_Locale: input.locale ?? "vn",
    vnp_ReturnUrl: config.returnUrl,
    vnp_IpAddr: input.ipAddress,
    vnp_CreateDate: formatVnpayTime(input.createdAt),
    vnp_ExpireDate: formatVnpayTime(expire),
  };

  const secureHash = sign(params, config.hashSecret);
  return `${config.payUrl}?${buildSignData(params)}&vnp_SecureHash=${secureHash}`;
}

export type VerifyResult =
  | { ok: true; txnRef: string; amountVnd: number; responseCode: string; succeeded: boolean }
  | { ok: false; reason: string };

/**
 * Kiểm chứng dữ liệu VNPay trả về (cả returnUrl lẫn IPN).
 *
 * KHÔNG được tin `vnp_ResponseCode` trước khi chữ ký khớp: bất kỳ ai cũng gõ
 * được `?vnp_ResponseCode=00` lên thanh địa chỉ. Chữ ký là thứ duy nhất chứng
 * minh dữ liệu đến từ VNPay.
 */
export function verifyReturn(query: Record<string, string>, hashSecret: string): VerifyResult {
  const received = query.vnp_SecureHash;
  if (!received) return { ok: false, reason: "Thiếu chữ ký." };

  const params = { ...query };
  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;

  const expected = sign(params, hashSecret);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received.toLowerCase(), "utf8");
  // So sánh theo thời gian hằng định: so sánh chuỗi thường rò rỉ thông tin qua
  // thời gian và cho phép dò dần từng ký tự của chữ ký.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "Chữ ký không khớp." };
  }

  const amount = Number(params.vnp_Amount);
  if (!Number.isFinite(amount) || amount % 100 !== 0) {
    return { ok: false, reason: "Số tiền không hợp lệ." };
  }

  return {
    ok: true,
    txnRef: params.vnp_TxnRef ?? "",
    amountVnd: amount / 100,
    responseCode: params.vnp_ResponseCode ?? "",
    // "00" là mã duy nhất nghĩa là đã thu tiền thành công.
    succeeded: params.vnp_ResponseCode === "00" && params.vnp_TransactionStatus === "00",
  };
}
