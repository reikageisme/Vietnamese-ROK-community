import type { ScanProduct } from "@prisma/client";

export const scanCatalog: Record<ScanProduct, { name: string; description: string; credits: number }> = {
  KINGDOM_OVERVIEW: { name: "Tổng quan Kingdom", description: "Sức mạnh, KP, dead và ảnh tổng quan gần nhất.", credits: 50 },
  GOVERNOR_TOP_300: { name: "Top 300 thống đốc", description: "Danh sách 300 người chơi cùng các chỉ số chính.", credits: 120 },
  KVK_CAMP: { name: "Bản đồ trại KvK", description: "Nhóm kingdom theo trại và bảng tổng hợp chiến trường.", credits: 250 },
};

export const topUpCatalog = [
  { amountVnd: 50_000, credits: 50 },
  { amountVnd: 100_000, credits: 110 },
  { amountVnd: 200_000, credits: 240 },
] as const;

export function isOpsSurface() {
  return process.env.APP_SURFACE === "ops";
}

export function isPublicDataRequestsEnabled() {
  return process.env.PUBLIC_DATA_REQUESTS === "true";
}
