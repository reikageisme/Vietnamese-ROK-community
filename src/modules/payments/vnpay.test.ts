import { describe, expect, it } from "vitest";

import { buildSignData, createPaymentUrl, formatVnpayTime, sign, verifyReturn } from "./vnpay";

const CONFIG = {
  tmnCode: "DEMO0001",
  hashSecret: "SECRET_FOR_TESTS_ONLY",
  payUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  returnUrl: "https://rokfaq.com/api/scan-service/vnpay-return",
};

const INPUT = {
  txnRef: "TOPUP123",
  amountVnd: 129_000,
  orderInfo: "Nap credit ROK FAQ",
  ipAddress: "1.2.3.4",
  createdAt: new Date("2026-08-22T10:00:00Z"),
};

/** Dựng lại query trả về từ một link thanh toán, như thể VNPay gửi về. */
function returnQuery(over: Record<string, string> = {}) {
  const params: Record<string, string> = {
    vnp_Amount: "12900000",
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_TxnRef: "TOPUP123",
    vnp_TmnCode: CONFIG.tmnCode,
    ...over,
  };
  return { ...params, vnp_SecureHash: sign(params, CONFIG.hashSecret) };
}

describe("VNPay", () => {
  it("đổi dấu thời gian sang giờ Việt Nam", () => {
    // 10:00 UTC = 17:00 giờ Việt Nam.
    expect(formatVnpayTime(new Date("2026-08-22T10:00:00Z"))).toBe("20260822170000");
  });

  it("sắp xếp tham số theo tên khi dựng chuỗi ký", () => {
    expect(buildSignData({ b: "2", a: "1", c: "3" })).toBe("a=1&b=2&c=3");
  });

  it("bỏ tham số rỗng khỏi chuỗi ký", () => {
    expect(buildSignData({ a: "1", b: "" })).toBe("a=1");
  });

  it("mã hoá khoảng trắng thành dấu cộng", () => {
    expect(buildSignData({ info: "nap credit" })).toBe("info=nap+credit");
  });

  it("nhân số tiền với 100", () => {
    const url = createPaymentUrl(CONFIG, INPUT);
    expect(url).toContain("vnp_Amount=12900000");
  });

  it("từ chối số tiền không phải số nguyên dương", () => {
    expect(() => createPaymentUrl(CONFIG, { ...INPUT, amountVnd: 0 })).toThrow();
    expect(() => createPaymentUrl(CONFIG, { ...INPUT, amountVnd: 1.5 })).toThrow();
  });

  it("gắn chữ ký vào cuối liên kết", () => {
    expect(createPaymentUrl(CONFIG, INPUT)).toMatch(/&vnp_SecureHash=[0-9a-f]{128}$/);
  });

  it("cùng đầu vào cho cùng liên kết", () => {
    expect(createPaymentUrl(CONFIG, INPUT)).toBe(createPaymentUrl(CONFIG, INPUT));
  });

  it("chấp nhận dữ liệu trả về có chữ ký đúng", () => {
    const result = verifyReturn(returnQuery(), CONFIG.hashSecret);
    expect(result).toMatchObject({ ok: true, txnRef: "TOPUP123", amountVnd: 129_000, succeeded: true });
  });

  it("TỪ CHỐI khi có người sửa số tiền", () => {
    const query = returnQuery();
    query.vnp_Amount = "100";
    expect(verifyReturn(query, CONFIG.hashSecret)).toMatchObject({ ok: false });
  });

  it("TỪ CHỐI khi có người tự gõ mã thành công", () => {
    // Đây là kịch bản tấn công thật: gõ ?vnp_ResponseCode=00 lên thanh địa chỉ.
    const query = returnQuery({ vnp_ResponseCode: "24" });
    query.vnp_ResponseCode = "00";
    expect(verifyReturn(query, CONFIG.hashSecret)).toMatchObject({ ok: false });
  });

  it("từ chối khi thiếu chữ ký", () => {
    const query = returnQuery();
    delete (query as Record<string, string>).vnp_SecureHash;
    expect(verifyReturn(query, CONFIG.hashSecret)).toMatchObject({ ok: false, reason: "Thiếu chữ ký." });
  });

  it("từ chối khi ký bằng chuỗi bí mật khác", () => {
    expect(verifyReturn(returnQuery(), "SAI_SECRET")).toMatchObject({ ok: false });
  });

  it("chữ ký đúng nhưng giao dịch thất bại thì succeeded = false", () => {
    const result = verifyReturn(returnQuery({ vnp_ResponseCode: "24", vnp_TransactionStatus: "02" }), CONFIG.hashSecret);
    expect(result).toMatchObject({ ok: true, succeeded: false, responseCode: "24" });
  });

  it("không phân biệt hoa thường ở chữ ký nhận về", () => {
    const query = returnQuery();
    query.vnp_SecureHash = query.vnp_SecureHash.toUpperCase();
    expect(verifyReturn(query, CONFIG.hashSecret)).toMatchObject({ ok: true });
  });
});
