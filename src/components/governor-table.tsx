"use client";

import { useMemo, useState } from "react";
import { formatCompact, formatInteger, governors } from "@/data/kingdom-demo";

export function GovernorTable() {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => governors.filter((governor) => `${governor.name} ${governor.id} ${governor.alliance}`.toLowerCase().includes(query.toLowerCase())), [query]);
  return <section className="data-panel">
    <div className="panel-heading"><div><span className="panel-kicker">DỮ LIỆU THỐNG ĐỐC</span><h2>Top người chơi được quét gần nhất</h2><p>Dữ liệu minh họa — số liệu thật sẽ đi qua bước xác minh ảnh/OCR.</p></div><label className="data-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên, ID, liên minh..." /></label></div>
    <div className="data-table-wrap"><table className="data-table governor-table"><thead><tr><th>#</th><th>Thống đốc</th><th>Liên minh</th><th>Lực chiến</th><th>Kill Points</th><th>T4</th><th>T5</th><th>Quân chết</th><th>Trợ giúp</th></tr></thead><tbody>{rows.map((governor) => <tr key={governor.id}><td>{governor.rank}</td><td><span className="governor-cell"><span className="governor-avatar">{governor.name.slice(0, 1).toUpperCase()}</span><span><strong>{governor.name}</strong><small>ID {governor.id} · {governor.capturedAt}</small></span></span></td><td><span className="alliance-tag">[{governor.alliance}]</span></td><td><strong>{formatInteger(governor.power)}</strong></td><td>{formatCompact(governor.killPoints)}</td><td>{formatCompact(governor.t4Kills)}</td><td>{formatCompact(governor.t5Kills)}</td><td>{formatCompact(governor.deadTroops)}</td><td>{formatInteger(governor.helps)}</td></tr>)}</tbody></table></div>
  </section>;
}
