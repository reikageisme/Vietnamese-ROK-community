import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GovernorTable } from "@/components/governor-table";
import { campMeta, formatCompact, formatInteger, kingdoms } from "@/data/kingdom-demo";

type Props = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { number } = await params;
  return { title: `Kingdom ${number}` };
}

export default async function KingdomDetailPage({ params }: Props) {
  const { number } = await params;
  const kingdom = kingdoms.find((row) => row.number === Number(number));
  if (!kingdom) notFound();
  const metrics = [
    ["Tổng lực chiến", formatCompact(kingdom.power), "+2.4%", "green"],
    ["Kill Points", formatCompact(kingdom.killPoints), "+486.5M", "blue"],
    ["Quân chết", formatCompact(kingdom.deadTroops), "+272.5K", "purple"],
    ["T4 kills", formatCompact(kingdom.t4Kills), "Top 12%", "orange"],
    ["T5 kills", formatCompact(kingdom.t5Kills), `${kingdom.top300} players`, "red"],
  ];
  return <div className="data-page kingdom-detail-page"><section className="kingdom-detail-hero"><div className="shell"><Link className="back-link" href="/kingdoms">← Tất cả kingdom</Link><div className="kingdom-title-row"><div><span className="data-eyebrow"><i /> KINGDOM #{kingdom.number} · TRẠI {kingdom.camp}</span><h1>{kingdom.name}</h1><p><span className="status-dot" /> {kingdom.status} · cập nhật {kingdom.updatedAt} · Seed #{kingdom.seed}</p></div><div className="kingdom-emblem"><span className={`camp-orb camp-${kingdom.camp.toLowerCase()}`}>{kingdom.camp}</span><span><small>KVK CAMP</small><strong>{campMeta[kingdom.camp].name}</strong></span></div></div></div></section>
    <div className="shell data-stack"><div className="metric-grid">{metrics.map(([label, value, delta, tone]) => <article className={`metric-card tone-${tone}`} key={label}><span>{label}</span><strong>{value}</strong><small>{delta}</small><div className="sparkline"><i/><i/><i/><i/><i/><i/></div></article>)}</div>
      <section className="kingdom-insight-grid"><article className="data-panel radar-panel"><div className="panel-heading"><div><span className="panel-kicker">KINGDOM GRADE</span><h2>Chỉ số tổng hợp</h2></div><span className="grade-badge">A</span></div><div className="radar-placeholder"><div className="radar-shape"/><span className="radar-top">Power 92%</span><span className="radar-right">Activity 86%</span><span className="radar-bottom">Development 78%</span><span className="radar-left">Field 89%</span></div></article><article className="data-panel scan-proof"><div className="panel-heading"><div><span className="panel-kicker">PROVENANCE</span><h2>Nguồn dữ liệu</h2></div></div><dl><div><dt>Độ phủ</dt><dd><span className="coverage">{kingdom.coverage}%</span></dd></div><div><dt>Hồ sơ đã quét</dt><dd>{kingdom.top300}</dd></div><div><dt>Ảnh bằng chứng</dt><dd>{formatInteger(1214)}</dd></div><div><dt>Collector</dt><dd>phone01 / OCR v0.1</dd></div><div><dt>Trạng thái</dt><dd><span className="verified-pill">Chờ xác minh cộng đồng</span></dd></div></dl></article></section>
      <GovernorTable />
    </div>
  </div>;
}
