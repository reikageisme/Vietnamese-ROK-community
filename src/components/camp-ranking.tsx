import Link from "next/link";

export type PublicCamp = { code: string; name: string; color: string; members: Array<{ number: number; name: string | null; power: string; killPoints: string; deadTroops: string; coverage: number; capturedAt: string | null }> };

function compact(value: bigint) { return new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 2 }).format(Number(value)); }

export function CampRanking({ camps }: { camps: PublicCamp[] }) {
  const ranked = camps.map((camp) => ({ ...camp, power: camp.members.reduce((sum, row) => sum + BigInt(row.power), BigInt(0)), killPoints: camp.members.reduce((sum, row) => sum + BigInt(row.killPoints), BigInt(0)), deaths: camp.members.reduce((sum, row) => sum + BigInt(row.deadTroops), BigInt(0)), coverage: camp.members.length ? Math.round(camp.members.reduce((sum, row) => sum + row.coverage, 0) / camp.members.length) : 0 })).sort((a, b) => a.power === b.power ? 0 : a.power > b.power ? -1 : 1);
  if (!ranked.length) return <div className="empty-data">Chưa có dữ liệu trại cho chiến dịch này.</div>;
  return <div className="camp-ranking">{ranked.map((camp, index) => <details className="camp-row" key={camp.code} open={index === 0}>
    <summary><span className="camp-position">{index + 1}</span><span className="camp-orb" style={{ background: camp.color }}>{camp.code}</span><span className="camp-summary-name"><strong>{camp.name}</strong><small>{camp.members.length} kingdoms</small></span><span><small>Lực chiến</small><strong>{compact(camp.power)}</strong></span><span><small>Kill Points</small><strong>{compact(camp.killPoints)}</strong></span><span><small>Quân chết</small><strong>{compact(camp.deaths)}</strong></span><span className={`coverage ${camp.coverage < 85 ? "coverage-warn" : ""}`}>{camp.coverage}%</span><b>⌄</b></summary>
    <div className="camp-members">{camp.members.length ? camp.members.map((kingdom) => <Link href={`/kingdoms/${kingdom.number}`} key={kingdom.number}><span>KD {kingdom.number}</span><strong>{kingdom.name ?? `Kingdom ${kingdom.number}`}</strong><small>{kingdom.capturedAt ? `${compact(BigInt(kingdom.power))} lực chiến · ${new Date(kingdom.capturedAt).toLocaleDateString("vi-VN")}` : "Chưa có dữ liệu tổng hợp"}</small></Link>) : <p className="empty-state">Chưa xếp Kingdom vào trại này.</p>}</div>
  </details>)}</div>;
}
