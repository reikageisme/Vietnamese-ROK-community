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

  return <div className="min-h-screen bg-[#0B1528] text-[#D8E5F5] font-sans p-4 md:p-8">
    <div className="max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="relative w-full mb-10">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-[rgba(18,32,54,0.94)] px-4 py-16 md:py-24 text-center shadow-2xl border border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/40 via-[#0B1528]/80 to-[#0B1528] pointer-events-none"></div>
          <div className="relative z-10">
            <span className="inline-block mb-4 px-4 py-1.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold tracking-widest uppercase border border-blue-500/30">
              ROKFAQ Intelligence
            </span>
            <h1 className="mb-4 text-4xl md:text-7xl font-black tracking-tight drop-shadow-2xl text-transparent bg-clip-text bg-gradient-to-br from-yellow-200 via-yellow-400 to-amber-600">
              Bản đồ sức mạnh
            </h1>
            <p className="text-lg md:text-xl font-medium text-blue-200 drop-shadow-md">
              Kingdom Việt Nam & Dữ liệu cộng đồng
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
        {/* Total Power */}
        <div className="rounded-3xl p-6 shadow-2xl border-2 border-red-500/20 bg-gradient-to-br from-red-900/70 to-red-950/90 text-white relative overflow-hidden group hover:border-red-500/40 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="flex items-center justify-between mb-6 relative z-10">
            <h3 className="font-bold text-red-100 text-lg">Tổng điểm ghi nhận</h3>
            <div className="p-3 bg-red-500/20 rounded-xl"><span className="text-2xl drop-shadow-md">⚔️</span></div>
          </div>
          <div className="mb-2 relative z-10">
            <p className="text-4xl md:text-5xl font-black tracking-tight mb-2">{compact(totalPower)}</p>
            <p className="text-sm font-medium text-red-300">Tổng Power trên Seed Ranking</p>
          </div>
        </div>
        
        {/* Tracked Kingdoms */}
        <div className="rounded-3xl p-6 shadow-2xl border-2 border-purple-500/20 bg-gradient-to-br from-purple-900/70 to-purple-950/90 text-white relative overflow-hidden group hover:border-purple-500/40 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="flex items-center justify-between mb-6 relative z-10">
            <h3 className="font-bold text-purple-100 text-lg">Kingdoms</h3>
            <div className="p-3 bg-purple-500/20 rounded-xl"><span className="text-2xl drop-shadow-md">🏰</span></div>
          </div>
          <div className="mb-2 relative z-10">
            <p className="text-4xl md:text-5xl font-black tracking-tight mb-2">{catalog.length}</p>
            <p className="text-sm font-medium text-purple-300">Kingdoms trong danh mục</p>
          </div>
        </div>

        {/* Coverage */}
        <div className="rounded-3xl p-6 shadow-2xl border-2 border-amber-500/20 bg-gradient-to-br from-amber-900/70 to-amber-950/90 text-white relative overflow-hidden flex flex-col group hover:border-amber-500/40 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="flex items-center justify-between mb-6 relative z-10">
            <h3 className="font-bold text-amber-100 text-lg">Độ hoàn thiện</h3>
            <div className="p-3 bg-amber-500/20 rounded-xl"><span className="text-2xl drop-shadow-md">🎯</span></div>
          </div>
          <div className="mb-2 relative z-10">
            <p className="text-4xl md:text-5xl font-black tracking-tight mb-2">{coverage}%</p>
            <p className="text-sm font-medium text-amber-300">Trung bình hồ sơ thu thập</p>
          </div>
        </div>

        {/* Next Update */}
        <div className="rounded-3xl p-6 shadow-2xl border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-900/70 to-emerald-950/90 text-white relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="flex items-center justify-between mb-6 relative z-10">
            <h3 className="font-bold text-emerald-100 text-lg">Cập nhật mới nhất</h3>
            <div className="p-3 bg-emerald-500/20 rounded-xl"><span className="text-2xl drop-shadow-md">⏱️</span></div>
          </div>
          <div className="mb-2 relative z-10">
            <p className="text-2xl md:text-3xl font-bold font-mono tracking-tighter mb-2 text-emerald-100">
              {latest ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(latest) : "—"}
            </p>
            <p className="text-sm font-medium text-emerald-400">Dữ liệu từ cộng đồng</p>
          </div>
        </div>
      </div>

      <KingdomExplorer kingdoms={rows} />
    </div>
  </div>;
}
