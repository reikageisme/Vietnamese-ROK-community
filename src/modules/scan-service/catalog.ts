import type { ScanProduct } from "@prisma/client";

export const scanCatalog: Record<ScanProduct, { name: string; description: string; credits: number }> = {
  KINGDOM_OVERVIEW: { name: "Tổng quan Kingdom", description: "Sức mạnh, KP, dead và ảnh tổng quan gần nhất.", credits: 50 },
  GOVERNOR_TOP_300: { name: "Top 300 thống đốc", description: "Danh sách 300 người chơi cùng các chỉ số chính.", credits: 120 },
  KVK_CAMP: { name: "Bản đồ trại KvK", description: "Nhóm kingdom theo trại và bảng tổng hợp chiến trường.", credits: 250 },
};

/** Hai gói nạp.
 *
 * Giá bám theo mốc 5 và 10 đô, quy ra tiền Việt rồi làm tròn xuống mốc số đẹp:
 * 129.000đ ~ 4,92 USD và 259.000đ ~ 9,87 USD ở tỷ giá ~26.235đ (tháng 8/2026).
 * Tỷ giá trôi thì SỬA Ở ĐÂY, đừng rải số ra giao diện.
 *
 * Số credit chọn theo giá sản phẩm: gói Cơ bản đủ một bảng Top 300 (120 credit),
 * gói Nâng cao đủ một bản đồ trại KvK (250 credit) và còn dư.
 */
export const topUpCatalog = [
  {
    code: "BASIC",
    name: "Gói Cơ bản",
    amountVnd: 129_000,
    credits: 150,
    highlight: "Đủ cho một bảng Top 300 thống đốc",
    bonusPercent: 0,
  },
  {
    code: "PLUS",
    name: "Gói Nâng cao",
    amountVnd: 259_000,
    credits: 330,
    highlight: "Đủ cho một bản đồ trại KvK, còn dư cho tổng quan kingdom",
    bonusPercent: 10,
  },
] as const;

export type TopUpPackage = (typeof topUpCatalog)[number];

export function findTopUpPackage(amountVnd: number): TopUpPackage | undefined {
  return topUpCatalog.find((item) => item.amountVnd === amountVnd);
}

export function isOpsSurface() {
  return process.env.APP_SURFACE === "ops";
}

export function isPublicDataRequestsEnabled() {
  return process.env.PUBLIC_DATA_REQUESTS === "true";
}
