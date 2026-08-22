/** Kiểu dữ liệu cho bộ tính chỉ số của bàn thử.
 *
 * Tách khỏi Prisma có chủ ý: bộ tính là hàm thuần, không biết gì về cơ sở dữ
 * liệu, nên test được mà không cần dựng Postgres. Tầng gọi có nhiệm vụ đọc bảng
 * rồi chuyển thành các kiểu ở đây.
 */

export type StatKind = "FLAT" | "PERCENT";
export type StatStackRule = "ADDITIVE" | "MULTIPLICATIVE" | "MAX_ONLY";
export type Verification = "UNVERIFIED" | "SCREENSHOT" | "CONFIRMED";

/** Thứ tự tin cậy tăng dần. Một dòng chỉ số đáng tin bằng nguồn yếu nhất của nó. */
export const VERIFICATION_ORDER: Verification[] = ["UNVERIFIED", "SCREENSHOT", "CONFIRMED"];

export type StatDefinition = {
  key: string;
  kind: StatKind;
  stackRule: StatStackRule;
  /** Nhóm hiển thị: infantry, cavalry, archer, siege, general, march... */
  group: string;
  sortOrder?: number;
};

export type SourceKind =
  | "EQUIPMENT"
  | "EQUIPMENT_TALENT"
  | "SET_BONUS"
  | "INSCRIPTION"
  | "ARMAMENT"
  | "ARMAMENT_TALENT"
  | "COMMANDER_TALENT"
  | "OTHER";

/** Con số này từ đâu ra. Người dùng bấm vào tổng là thấy được danh sách này. */
export type SourceRef = {
  kind: SourceKind;
  id: string;
  /** Nhãn hiển thị, ví dụ "Mũ Thánh Chiến · bậc IV". */
  label: string;
  verification: Verification;
  /** Chỉ cộng khi có điều kiện (đang tấn công, đang rally...). */
  conditional?: boolean;
};

export type Contribution = {
  statKey: string;
  value: number;
  source: SourceRef;
};

export type StatLine = {
  key: string;
  kind: StatKind;
  group: string;
  stackRule: StatStackRule;
  /** Tổng của phần LUÔN có hiệu lực. */
  total: number;
  /** Tổng của phần chỉ có hiệu lực khi thoả điều kiện — luôn tách riêng. */
  conditionalTotal: number;
  contributions: Contribution[];
  /** Bằng nguồn yếu nhất góp vào dòng này. */
  verification: Verification;
};

export type StatSheet = {
  lines: StatLine[];
  byKey: Record<string, StatLine>;
  /** Vấn đề về dữ liệu, phải hiện ra giao diện chứ không nuốt im lặng. */
  warnings: string[];
  /** Nguồn chưa ai đối chiếu trong game. */
  unverifiedSources: SourceRef[];
};
