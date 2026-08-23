import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GovernorTable, type GovernorRow } from "@/components/governor-table";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { number } = await params;
  return { title: `Kingdom ${number}` };
}

function compact(value: bigint | null | undefined) { return value === null || value === undefined ? "—" : new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 2 }).format(Number(value)); }

export default async function KingdomDetailPage({ params }: Props) {
  const number = Number((await params).number);
  if (!Number.isInteger(number)) notFound();
  const kingdom = await prisma.kingdom.findUnique({
    where: { number },
    include: {
      snapshots: { orderBy: { capturedAt: "desc" }, take: 1 },
      campMemberships: { orderBy: { createdAt: "desc" }, take: 1, include: { camp: { include: { campaign: true } } } },
      governors: { take: 500, include: { alliance: { select: { tag: true } }, snapshots: { orderBy: { capturedAt: "desc" }, take: 1 } } },
    },
  });
  if (!kingdom) notFound();
  const snapshot = kingdom.snapshots[0] ?? null;
  const membership = kingdom.campMemberships[0] ?? null;
  const governors: GovernorRow[] = kingdom.governors.flatMap((profile) => {
    const row = profile.snapshots[0];
    return row ? [{ id: profile.governorId, name: profile.governorName, alliance: profile.alliance?.tag ?? null, power: row.power.toString(), killPoints: row.killPoints.toString(), t4Kills: (row.t4Kills ?? BigInt(0)).toString(), t5Kills: (row.t5Kills ?? BigInt(0)).toString(), deadTroops: row.deadTroops.toString(), helps: (row.helps ?? BigInt(0)).toString(), capturedAt: row.capturedAt.toISOString() }] : [];
  }).sort((left, right) => BigInt(left.power) === BigInt(right.power) ? 0 : BigInt(left.power) > BigInt(right.power) ? -1 : 1).slice(0, 300);
  const metrics = [
    ["Tổng lực chiến", compact(snapshot?.power), "Dữ liệu tổng hợp", "green"],
    ["Kill Points", compact(snapshot?.killPoints), "Toàn danh sách", "blue"],
    ["Quân chết", compact(snapshot?.deadTroops), "Toàn danh sách", "purple"],
    ["T4 kills", compact(snapshot?.t4Kills), "Đã ghi nhận", "orange"],
    ["T5 kills", compact(snapshot?.t5Kills), `${snapshot?.governorCount ?? 0} hồ sơ`, "red"],
  ];
  return <div className="data-page kingdom-detail-page"><section className="kingdom-detail-hero"><div className="shell"><Link className="back-link" href="/kingdoms">← Tất cả kingdom</Link><div className="kingdom-title-row"><div><span className="data-eyebrow"><i /> KINGDOM #{kingdom.number}{membership ? ` · TRẠI ${membership.camp.code}` : ""}</span><h1>{kingdom.name ?? `Kingdom ${kingdom.number}`}</h1><p><span className="status-dot" /> {snapshot ? `cập nhật ${snapshot.capturedAt.toLocaleString("vi-VN")}` : "chưa có dữ liệu tổng hợp"}{membership?.seed ? ` · Seed #${membership.seed}` : ""}</p></div>{membership ? <div className="kingdom-emblem"><span className="camp-orb kingdom-orb">{membership.camp.code}</span><span><small>{membership.camp.campaign.code}</small><strong>{membership.camp.name}</strong></span></div> : null}</div></div></section>
    <div className="shell data-stack"><div className="metric-grid">{metrics.map(([label, value, note, tone]) => <article className={`metric-card tone-${tone}`} key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small><div className="sparkline"><i/><i/><i/><i/><i/><i/></div></article>)}</div>
      <section className="data-panel public-data-summary"><div className="panel-heading"><div><span className="panel-kicker">DATA STATUS</span><h2>Tình trạng dữ liệu</h2><p>Thông tin công bố cho cộng đồng, không hiển thị cấu hình vận hành nội bộ.</p></div><span className="live-pill"><i /> {snapshot ? "AVAILABLE" : "PENDING"}</span></div><dl><div><dt>Độ hoàn thiện</dt><dd><span className="coverage">{snapshot?.coveragePercent ?? 0}%</span></dd></div><div><dt>Hồ sơ</dt><dd>{snapshot?.governorCount ?? 0}</dd></div><div><dt>Chiến dịch</dt><dd>{membership?.camp.campaign.name ?? "Chưa phân loại"}</dd></div><div><dt>Trạng thái</dt><dd><span className="verified-pill">{snapshot ? "Đã ghi nhận" : "Đang bổ sung"}</span></dd></div></dl></section>
      <GovernorTable governors={governors} />
    </div>
  </div>;
}
