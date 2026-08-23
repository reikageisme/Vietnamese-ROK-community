"use client";

import { useMemo, useState } from "react";

export type GovernorRow = { id: string; name: string; alliance: string | null; power: string; killPoints: string; t4Kills: string; t5Kills: string; deadTroops: string; helps: string; capturedAt: string };

function compact(value: string) { return new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 2 }).format(Number(value)); }
function integer(value: string) { return BigInt(value).toLocaleString("vi-VN"); }

export function GovernorTable({ governors }: { governors: GovernorRow[] }) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => governors.filter((governor) => `${governor.name} ${governor.id} ${governor.alliance ?? ""}`.toLowerCase().includes(query.toLowerCase())), [governors, query]);
  return <section className="data-panel">
    <div className="panel-heading"><div><span className="panel-kicker">DỮ LIỆU THỐNG ĐỐC</span><h2>Danh sách cập nhật gần nhất</h2><p>Chỉ hiển thị hồ sơ đã có dữ liệu trong hệ thống.</p></div><label className="data-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên, ID, liên minh..." /></label></div>
    {rows.length ? <div className="data-table-wrap"><table className="data-table governor-table"><thead><tr><th>#</th><th>Thống đốc</th><th>Liên minh</th><th>Lực chiến</th><th>Kill Points</th><th>T4</th><th>T5</th><th>Quân chết</th><th>Trợ giúp</th></tr></thead><tbody>{rows.map((governor, index) => <tr key={governor.id}><td>{index + 1}</td><td><span className="governor-cell"><span className="governor-avatar">{governor.name.slice(0, 1).toUpperCase()}</span><span><strong>{governor.name}</strong><small>ID {governor.id} · {new Date(governor.capturedAt).toLocaleDateString("vi-VN")}</small></span></span></td><td><span className="alliance-tag">{governor.alliance ? `[${governor.alliance}]` : "—"}</span></td><td><strong>{integer(governor.power)}</strong></td><td>{compact(governor.killPoints)}</td><td>{compact(governor.t4Kills)}</td><td>{compact(governor.t5Kills)}</td><td>{compact(governor.deadTroops)}</td><td>{integer(governor.helps)}</td></tr>)}</tbody></table></div> : <div className="empty-data">Kingdom này chưa có hồ sơ thống đốc được công bố.</div>}
  </section>;
}
