"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { campMeta, formatCompact, kingdoms, type CampCode } from "@/data/kingdom-demo";

const camps: Array<CampCode | "ALL"> = ["ALL", "A", "B", "C", "D"];

export function KingdomExplorer() {
  const [query, setQuery] = useState("");
  const [camp, setCamp] = useState<CampCode | "ALL">("ALL");
  const rows = useMemo(() => kingdoms.filter((kingdom) => {
    const matchesQuery = `${kingdom.number} ${kingdom.name}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (camp === "ALL" || kingdom.camp === camp);
  }), [query, camp]);

  return <>
    <div className="data-toolbar">
      <div className="segment-control">{camps.map((code) => <button key={code} className={camp === code ? "active" : ""} onClick={() => setCamp(code)}>{code === "ALL" ? "Tất cả" : `Trại ${code}`}</button>)}</div>
      <label className="data-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm số KD hoặc tên..." /></label>
    </div>
    <div className="data-table-wrap">
      <table className="data-table kingdom-table">
        <thead><tr><th>Hạng</th><th>Kingdom</th><th>Trại</th><th>Lực chiến Top 300</th><th>Kill Points</th><th>Quân chết</th><th>Độ phủ</th><th /></tr></thead>
        <tbody>{rows.map((kingdom) => <tr key={kingdom.number}>
          <td><span className="rank-number">{kingdom.seed}</span></td>
          <td><Link className="kingdom-cell" href={`/kingdoms/${kingdom.number}`}><span className={`camp-orb camp-${kingdom.camp.toLowerCase()}`}>{kingdom.camp}</span><span><strong>KD {kingdom.number}</strong><small>{kingdom.name}</small></span></Link></td>
          <td><span className="camp-label" style={{ "--camp-color": campMeta[kingdom.camp].color } as React.CSSProperties}>{campMeta[kingdom.camp].name}</span></td>
          <td><strong>{formatCompact(kingdom.power)}</strong><small className="table-sub">Top {kingdom.top300} thống đốc</small></td>
          <td>{formatCompact(kingdom.killPoints)}</td><td>{formatCompact(kingdom.deadTroops)}</td>
          <td><span className={`coverage ${kingdom.coverage < 85 ? "coverage-warn" : ""}`}>{kingdom.coverage}%</span></td>
          <td><Link className="row-arrow" href={`/kingdoms/${kingdom.number}`}>→</Link></td>
        </tr>)}</tbody>
      </table>
      {!rows.length && <div className="empty-data">Không tìm thấy kingdom phù hợp.</div>}
    </div>
  </>;
}
