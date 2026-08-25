/** Nhãn tiếng Việt cho các giá trị enum của kho trang bị.
 *
 * Để ở một chỗ vì chúng xuất hiện ở nhiều trang; sửa một nơi là đổi hết.
 */

export const SLOT_LABELS: Record<string, string> = {
  HELMET: "Mũ",
  CHEST: "Giáp",
  WEAPON: "Vũ khí",
  GLOVES: "Găng tay",
  LEGS: "Giáp chân",
  BOOTS: "Giày",
  ACCESSORY: "Phụ kiện",
};

export const RARITY_LABELS: Record<string, string> = {
  NORMAL: "Thường",
  ADVANCED: "Cao cấp",
  ELITE: "Tinh anh",
  EPIC: "Sử thi",
  LEGENDARY: "Huyền thoại",
};

export const VERIFICATION_LABELS: Record<string, string> = {
  UNVERIFIED: "Chưa kiểm chứng",
  SCREENSHOT: "Có ảnh trong game",
  CONFIRMED: "Đã đối chiếu",
};

/** Chữ số La Mã cho bậc. Quá 10 thì trả về số thường — không có hệ nào tới đó,
 *  nhưng thà hiện số còn hơn hiện chuỗi rỗng. */
export function tierLabel(tier: number): string {
  const romans = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return romans[tier] ?? String(tier);
}

/** Định dạng một chỉ số để hiển thị: phần trăm thì kèm dấu %, cộng thẳng thì không. */
export function formatStat(value: number, kind: "FLAT" | "PERCENT"): string {
  const rounded = Math.round(value * 100) / 100;
  const text = new Intl.NumberFormat("vi-VN").format(rounded);
  return kind === "PERCENT" ? `${text}%` : text;
}
