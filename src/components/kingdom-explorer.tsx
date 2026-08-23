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
    <div className="data-toolbar">
      <div className="segment-control">
        <button className={filter === "ALL" ? "active" : ""} onClick={() => setFilter("ALL")}>Tất cả</button>
        <button className={filter === "SCANNED" ? "active" : ""} onClick={() => setFilter("SCANNED")}>Đã có dữ liệu</button>
        <button className={filter === "PENDING" ? "active" : ""} onClick={() => setFilter("PENDING")}>Đang bổ sung</button>
      </div>
      <label className="data-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm số KD hoặc tên..." /></label>
    </div>
    <div className="data-table-wrap">
      <table className="data-table kingdom-table">
        <thead><tr><th>Hạng</th><th>Kingdom</th><th>Lực chiến bảng xếp hạng</th><th>Hồ sơ</th><th>Cần kiểm tra</th><th>Cập nhật gần nhất</th><th>Độ hoàn thiện</th><th /></tr></thead>
        <tbody>{rows.map((kingdom) => {
          const coverage = kingdom.capturedAt ? Math.min(100, Math.round(kingdom.recordCount * 100 / Math.max(kingdom.target, 1))) : 0;
          return <tr key={kingdom.number}>
            <td><span className="rank-number">{scannedRanks.get(kingdom.number) ?? "—"}</span></td>
            <td><Link className="kingdom-cell" href={`/kingdoms/${kingdom.number}`}><span className="camp-orb kingdom-orb">{String(kingdom.number).slice(-2)}</span><span><strong>KD {kingdom.number}</strong><small>{kingdom.name ?? "Chưa xác minh tên"}</small></span></Link></td>
            <td><strong>{compact(kingdom.power)}</strong><small className="table-sub">{kingdom.recordCount ? `Top ${kingdom.recordCount}` : "chưa cập nhật"}</small></td>
            <td>{kingdom.recordCount || "—"}</td>
            <td>{kingdom.reviewCount || "—"}</td>
            <td>{freshness(kingdom.capturedAt)}</td>
            <td><span className={`coverage ${coverage < 85 ? "coverage-warn" : ""}`}>{coverage}%</span></td>
            <td><Link className="row-arrow" href={`/kingdoms/${kingdom.number}`}>→</Link></td>
          </tr>;
        })}</tbody>
      </table>
      {!rows.length && <div className="empty-data">Không tìm thấy kingdom phù hợp.</div>}
    </div>
  </>;
}
