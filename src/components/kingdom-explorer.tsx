"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type KingdomCoverageRow = {
  number: number;
  name: string | null;
  power: string | null;
  recordCount: number;
  target: number;
  reviewCount: number;
  capturedAt: string | null;
};

function compact(value: string | null) {
  if (!value) return "—";
  return new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 2 }).format(Number(value));
}

function freshness(capturedAt: string | null) {
  if (!capturedAt) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(capturedAt));
}

export function KingdomExplorer({ kingdoms }: { kingdoms: KingdomCoverageRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | "SCANNED" | "PENDING">("ALL");
  const rows = useMemo(() => kingdoms.filter((kingdom) => {
    const matchesQuery = `${kingdom.number} ${kingdom.name ?? ""}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "ALL" || (filter === "SCANNED" ? kingdom.capturedAt : !kingdom.capturedAt);
    return matchesQuery && matchesFilter;
  }), [filter, kingdoms, query]);
  const scannedRanks = useMemo(() => new Map(kingdoms.filter((item) => item.power !== null).map((item, index) => [item.number, index + 1])), [kingdoms]);

  return <>
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-6 gap-4">
      <div>
        <span className="text-[10px] font-black tracking-[0.2em] text-blue-400 uppercase bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/30">Seed Ranking</span>
        <h2 className="text-3xl font-bold mt-4 text-white">Xếp hạng Kingdom</h2>
        <p className="text-sm text-blue-200/60 mt-1">Dữ liệu được cập nhật từ hệ thống cộng đồng ROK.</p>
      </div>
      <div className="flex flex-col items-end gap-3 self-start sm:self-end">
        <div className="px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-xs font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(34,197,94,0.15)]">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_5px_#4ade80]"></span>
          LIVE DATABASE
        </div>
      </div>
    </div>

    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4 bg-[rgba(18,32,54,0.94)] p-4 rounded-2xl border border-white/10 shadow-lg">
      <div className="flex flex-wrap gap-2">
        <button className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === "ALL" ? "bg-blue-600 text-white shadow-md" : "bg-white/5 text-gray-400 hover:bg-white/10"}`} onClick={() => setFilter("ALL")}>Tất cả</button>
        <button className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === "SCANNED" ? "bg-blue-600 text-white shadow-md" : "bg-white/5 text-gray-400 hover:bg-white/10"}`} onClick={() => setFilter("SCANNED")}>Đã có dữ liệu</button>
        <button className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === "PENDING" ? "bg-blue-600 text-white shadow-md" : "bg-white/5 text-gray-400 hover:bg-white/10"}`} onClick={() => setFilter("PENDING")}>Đang bổ sung</button>
      </div>
      <label className="flex items-center gap-2 bg-[#070D1A] px-4 py-2 rounded-xl border border-white/10 focus-within:border-blue-500/50 transition-colors">
        <span className="text-gray-400">⌕</span>
        <input className="bg-transparent border-none outline-none text-white placeholder-gray-500 text-sm w-full sm:w-64" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm số KD hoặc tên..." />
      </label>
    </div>

    <div className="bg-[rgba(18,32,54,0.94)] rounded-3xl border border-white/10 overflow-hidden shadow-2xl backdrop-blur-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[#070D1A] text-blue-300/70 border-b border-white/10 uppercase text-[10px] tracking-wider font-bold">
            <tr>
              <th className="px-6 py-5 text-center">Hạng</th>
              <th className="px-6 py-5">Kingdom</th>
              <th className="px-6 py-5">Tên (Name)</th>
              <th className="px-6 py-5 text-right">Lực chiến bảng xếp hạng</th>
              <th className="px-6 py-5 text-center">Hồ sơ</th>
              <th className="px-6 py-5 text-center">Cần KT</th>
              <th className="px-6 py-5 text-center w-48">Mức độ hoàn thiện</th>
              <th className="px-6 py-5 text-right">Trạng thái</th>
              <th className="px-6 py-5 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((kingdom) => {
              const coverage = kingdom.capturedAt ? Math.min(100, Math.round(kingdom.recordCount * 100 / Math.max(kingdom.target, 1))) : 0;
              const rank = scannedRanks.get(kingdom.number);
              return <tr key={kingdom.number} className="hover:bg-white/5 transition-colors group">
                <td className="px-6 py-5 text-center font-bold text-gray-400">{rank ?? "—"}</td>
                <td className="px-6 py-5 font-mono text-lg font-black text-yellow-400 drop-shadow-sm"><Link href={`/kingdoms/${kingdom.number}`}>{kingdom.number}</Link></td>
                <td className="px-6 py-5 font-bold text-white"><Link href={`/kingdoms/${kingdom.number}`}>{kingdom.name ?? <span className="italic text-gray-500">Chưa xác minh</span>}</Link></td>
                <td className="px-6 py-5 text-right font-mono font-bold text-gray-200">
                  {compact(kingdom.power)}
                  <div className="text-[10px] text-gray-500 font-normal mt-1">{kingdom.recordCount ? `Top ${kingdom.recordCount}` : "chưa cập nhật"}</div>
                </td>
                <td className="px-6 py-5 text-center text-gray-300">{kingdom.recordCount || "—"}</td>
                <td className="px-6 py-5 text-center text-gray-300">{kingdom.reviewCount || "—"}</td>
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-full bg-[#070D1A] rounded-full h-2.5 border border-white/5 overflow-hidden">
                      <div className={`h-full rounded-full ${coverage < 85 ? 'bg-gradient-to-r from-orange-600 to-yellow-400' : 'bg-gradient-to-r from-blue-600 to-cyan-400 shadow-[0_0_10px_rgba(56,189,248,0.5)]'}`} style={{ width: `${coverage}%` }}></div>
                    </div>
                    <span className={`text-xs font-bold ${coverage < 85 ? 'text-yellow-400' : 'text-cyan-400'}`}>{coverage}%</span>
                  </div>
                </td>
                <td className="px-6 py-5 text-right">
                  {kingdom.capturedAt ? 
                    <span className="px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-xs font-bold border border-green-500/20">{freshness(kingdom.capturedAt)}</span> : 
                    <span className="px-3 py-1.5 bg-yellow-500/10 text-yellow-500 rounded-lg text-xs font-bold border border-yellow-500/20">Chưa cập nhật</span>
                  }
                </td>
                <td className="px-6 py-5 text-center">
                  <Link href={`/kingdoms/${kingdom.number}`} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-blue-600 transition-colors text-white">→</Link>
                </td>
              </tr>;
            })}
          </tbody>
        </table>
        {!rows.length && <div className="p-10 text-center text-gray-400 font-medium">Không tìm thấy kingdom phù hợp.</div>}
      </div>
    </div>
  </>;
}
