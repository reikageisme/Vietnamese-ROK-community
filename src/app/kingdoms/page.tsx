import type { Metadata } from "next";
import { KingdomExplorer, type KingdomCoverageRow } from "@/components/kingdom-explorer";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Dữ liệu Kingdom" };
export const dynamic = "force-dynamic";

function compact(value: bigint) {
  return new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 2 }).format(Number(value));
}

export default async function KingdomsPage() {
  const [catalog, latestBatches] = await Promise.all([
    prisma.kingdom.findMany({ orderBy: { number: "asc" }, select: { number: true, name: true }, take: 5_000 }),
    prisma.rankingScanBatch.findMany({
      where: { rankingType: "RANKING_SEED" },
      orderBy: { capturedAt: "desc" },
      distinct: ["kingdomNumber"],
      select: {
        kingdomNumber: true,
        target: true,
        recordCount: true,
        capturedAt: true,
        entries: { select: { score: true, needsReview: true } },
      },
    }),
  ]);
  const batchByKingdom = new Map(latestBatches.map((batch) => [batch.kingdomNumber, batch]));
  const rows: KingdomCoverageRow[] = catalog.map((kingdom) => {
    const batch = batchByKingdom.get(kingdom.number);
    const power = batch?.entries.reduce((sum, entry) => sum + (entry.score ?? BigInt(0)), BigInt(0)) ?? null;
    return {
      number: kingdom.number,
      name: kingdom.name,
      power: power?.toString() ?? null,
      recordCount: batch?.recordCount ?? 0,
      target: batch?.target ?? 300,
      reviewCount: batch?.entries.filter((entry) => entry.needsReview).length ?? 0,
      capturedAt: batch?.capturedAt.toISOString() ?? null,
    };
  }).sort((left, right) => {
    if (left.power && right.power) return BigInt(left.power) === BigInt(right.power) ? 0 : BigInt(left.power) > BigInt(right.power) ? -1 : 1;
    if (left.power) return -1;
    if (right.power) return 1;
    return left.number - right.number;
  });
  const totalPower = rows.reduce((sum, row) => sum + BigInt(row.power ?? 0), BigInt(0));
  const scanned = rows.filter((row) => row.capturedAt);
  const coverage = scanned.length ? Math.round(scanned.reduce((sum, row) => sum + Math.min(100, row.recordCount * 100 / Math.max(row.target, 1)), 0) / scanned.length) : 0;
  const latest = latestBatches[0]?.capturedAt;
  return <div className="data-page">
    <section className="data-hero"><div className="shell data-hero-inner"><div><span className="data-eyebrow"><i /> ROKFAQ INTELLIGENCE</span><h1>Bản đồ sức mạnh<br/><em>Kingdom Việt Nam</em></h1><p>Dữ liệu cộng đồng có lịch sử cập nhật và mức hoàn thiện rõ ràng. Kingdom chưa có dữ liệu không được gán số liệu minh họa.</p></div><div className="hero-metrics"><div><strong>{catalog.length}</strong><span>Kingdom trong danh mục</span></div><div><strong>{compact(totalPower)}</strong><span>Tổng điểm đã ghi nhận</span></div><div><strong>{coverage}%</strong><span>Độ hoàn thiện trung bình</span></div><div><strong>{latest ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(latest) : "—"}</strong><span>Cập nhật mới nhất</span></div></div></div></section>
    <div className="shell data-stack"><section className="data-panel"><div className="panel-heading"><div><span className="panel-kicker">SEED RANKING</span><h2>Xếp hạng Kingdom</h2><p>{scanned.length} Kingdom đã có dữ liệu; các Kingdom còn lại đang được cộng đồng bổ sung.</p></div><span className="live-pill"><i /> LIVE DATABASE</span></div><KingdomExplorer kingdoms={rows} /></section></div>
  </div>;
}
