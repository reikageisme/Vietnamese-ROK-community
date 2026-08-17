import type { Metadata } from "next";
import { KingdomExplorer } from "@/components/kingdom-explorer";
import { formatCompact, kingdoms } from "@/data/kingdom-demo";

export const metadata: Metadata = { title: "Dữ liệu Kingdom" };

export default function KingdomsPage() {
  const totalPower = kingdoms.reduce((sum, kingdom) => sum + kingdom.power, 0);
  const coverage = Math.round(kingdoms.reduce((sum, kingdom) => sum + kingdom.coverage, 0) / kingdoms.length);
  return <div className="data-page">
    <section className="data-hero"><div className="shell data-hero-inner"><div><span className="data-eyebrow"><i /> ROKVIET INTELLIGENCE</span><h1>Bản đồ sức mạnh<br/><em>Kingdom Việt Nam</em></h1><p>Tổng hợp dữ liệu có nguồn, thời gian quét và độ phủ rõ ràng. Tìm kingdom, so sánh seed và theo dõi biến động qua từng lần quét.</p></div><div className="hero-metrics"><div><strong>{kingdoms.length}</strong><span>Kingdom mẫu</span></div><div><strong>{formatCompact(totalPower)}</strong><span>Tổng lực chiến</span></div><div><strong>{coverage}%</strong><span>Độ phủ dữ liệu</span></div><div><strong>17 Aug</strong><span>Cập nhật mới nhất</span></div></div></div></section>
    <div className="shell data-stack"><section className="data-panel"><div className="panel-heading"><div><span className="panel-kicker">SEED RANKING</span><h2>Xếp hạng Kingdom</h2><p>Dữ liệu minh họa để hoàn thiện giao diện trước khi collector gửi scan thật.</p></div><span className="live-pill"><i /> DEMO DATA</span></div><KingdomExplorer /></section></div>
  </div>;
}
