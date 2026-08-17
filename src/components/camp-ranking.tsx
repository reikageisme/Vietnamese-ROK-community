import Link from "next/link";
import { campMeta, formatCompact, kingdoms, type CampCode } from "@/data/kingdom-demo";

export function CampRanking() {
  const camps = (Object.keys(campMeta) as CampCode[]).map((code) => {
    const members = kingdoms.filter((kingdom) => kingdom.camp === code);
    return { code, members, power: members.reduce((sum, row) => sum + row.power, 0), killPoints: members.reduce((sum, row) => sum + row.killPoints, 0), deaths: members.reduce((sum, row) => sum + row.deadTroops, 0), coverage: Math.round(members.reduce((sum, row) => sum + row.coverage, 0) / members.length) };
  }).sort((a, b) => b.power - a.power);

  return <div className="camp-ranking">{camps.map((camp, index) => <details className="camp-row" key={camp.code} open={index === 0}>
    <summary><span className="camp-position">{index + 1}</span><span className={`camp-orb camp-${camp.code.toLowerCase()}`}>{camp.code}</span><span className="camp-summary-name"><strong>{campMeta[camp.code].name}</strong><small>{camp.members.length} kingdoms · hệ {campMeta[camp.code].tone}</small></span><span><small>Lực chiến</small><strong>{formatCompact(camp.power)}</strong></span><span><small>Kill Points</small><strong>{formatCompact(camp.killPoints)}</strong></span><span><small>Quân chết</small><strong>{formatCompact(camp.deaths)}</strong></span><span className="coverage">{camp.coverage}%</span><b>⌄</b></summary>
    <div className="camp-members">{camp.members.map((kingdom) => <Link href={`/kingdoms/${kingdom.number}`} key={kingdom.number}><span>KD {kingdom.number}</span><strong>{kingdom.name}</strong><small>{formatCompact(kingdom.power)} lực chiến · cập nhật {kingdom.updatedAt}</small></Link>)}</div>
  </details>)}</div>;
}
