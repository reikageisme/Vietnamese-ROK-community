import type { Metadata } from "next";
import { CampRanking, type PublicCamp } from "@/components/camp-ranking";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Trung tâm KvK" };
export const dynamic = "force-dynamic";

function date(value: Date | null) { return value ? value.toLocaleDateString("vi-VN") : "Chưa xác định"; }

export default async function KvkPage() {
  const include = { camps: { orderBy: { code: "asc" as const }, include: { kingdoms: { include: { kingdom: { include: { snapshots: { orderBy: { capturedAt: "desc" as const }, take: 1 } } } } } } } };
  const campaign = await prisma.kvkCampaign.findFirst({ where: { status: "ACTIVE" }, orderBy: { startsAt: "desc" }, include })
    ?? await prisma.kvkCampaign.findFirst({ orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }], include });
  if (!campaign) return <div className="data-page"><section className="kvk-hero"><div className="shell"><span className="data-eyebrow"><i /> KVK COMMUNITY HUB</span><div className="kvk-title-row"><div><h1>Trung tâm KvK</h1><p>Chưa có chiến dịch nào được công bố.</p></div></div></div></section><div className="shell data-stack"><section className="data-panel"><div className="empty-data">Dữ liệu chiến dịch đang được bổ sung.</div></section></div></div>;
  const now = Date.now();
  const start = campaign.startsAt?.getTime(); const end = campaign.endsAt?.getTime();
  const progress = start && end && end > start ? Math.max(0, Math.min(100, Math.round((now - start) * 100 / (end - start)))) : campaign.status === "COMPLETED" ? 100 : 0;
  const camps: PublicCamp[] = campaign.camps.map((camp) => ({ code: camp.code, name: camp.name, color: camp.color, members: camp.kingdoms.map(({ kingdom }) => { const snapshot = kingdom.snapshots[0]; return { number: kingdom.number, name: kingdom.name, power: (snapshot?.power ?? BigInt(0)).toString(), killPoints: (snapshot?.killPoints ?? BigInt(0)).toString(), deadTroops: (snapshot?.deadTroops ?? BigInt(0)).toString(), coverage: snapshot?.coveragePercent ?? 0, capturedAt: snapshot?.capturedAt.toISOString() ?? null }; }) }));
  const kingdomCount = camps.reduce((sum, camp) => sum + camp.members.length, 0);
  return <div className="data-page"><section className="kvk-hero"><div className="shell"><span className="data-eyebrow"><i /> KVK COMMUNITY HUB</span><div className="kvk-title-row"><div><h1>Chiến trường KvK<br/><em>#{campaign.code}</em></h1><p>{campaign.name}{campaign.mapName ? ` · ${campaign.mapName}` : ""} · {kingdomCount} kingdom</p></div><div className="kvk-progress"><span><b>Tiến trình KvK</b><strong>{progress}%</strong></span><div><i style={{ width: `${progress}%` }} /></div><small>{date(campaign.startsAt)} — {date(campaign.endsAt)}</small></div></div><div className="kvk-timeline"><article className="done"><i/><strong>Bắt đầu</strong><span>Mở chiến dịch</span><small>{date(campaign.startsAt)}</small></article><article className={campaign.status === "ACTIVE" ? "active" : campaign.status === "COMPLETED" ? "done" : "pending"}><i/><strong>{campaign.status === "ACTIVE" ? "Đang diễn ra" : campaign.status === "COMPLETED" ? "Đã hoàn thành" : "Sắp diễn ra"}</strong><span>{campaign.name}</span><small>{campaign.status}</small></article><article className={campaign.status === "COMPLETED" ? "done" : "pending"}><i/><strong>Kết thúc</strong><span>Tổng kết chiến dịch</span><small>{date(campaign.endsAt)}</small></article></div></div></section>
    <div className="shell data-stack"><section className="data-panel"><div className="panel-heading"><div><span className="panel-kicker">CAMP INTELLIGENCE</span><h2>Xếp hạng các trại</h2><p>Tổng hợp số liệu Kingdom đã được công bố theo từng phe.</p></div><span className="live-pill"><i /> {kingdomCount} KINGDOMS</span></div><CampRanking camps={camps} /></section></div>
  </div>;
}
