import type { Metadata } from "next";
import { CampRanking } from "@/components/camp-ranking";
import { kvkTimeline } from "@/data/kingdom-demo";

export const metadata: Metadata = { title: "Trung tâm KvK" };

export default function KvkPage() {
  return <div className="data-page"><section className="kvk-hero"><div className="shell"><span className="data-eyebrow"><i /> LOST KINGDOM TRACKER</span><div className="kvk-title-row"><div><h1>Chiến trường KvK<br/><em>#C13273</em></h1><p>Song of Troy · 32 kingdom · dữ liệu demo</p></div><div className="kvk-progress"><span><b>Tiến trình KvK</b><strong>33%</strong></span><div><i /></div><small>31/07/2026 — 21/09/2026</small></div></div><div className="kvk-timeline">{kvkTimeline.map((event) => <article className={event.state} key={event.name}><i/><strong>{event.name}</strong><span>{event.subtitle}</span><small>{event.date}</small></article>)}</div></div></section>
    <div className="shell data-stack"><section className="data-panel"><div className="panel-heading"><div><span className="panel-kicker">CAMP INTELLIGENCE</span><h2>Xếp hạng các trại</h2><p>Cộng tổng dữ liệu kingdom theo phe và luôn kèm độ phủ scan.</p></div><span className="live-pill"><i /> 32/32 KINGDOMS</span></div><CampRanking /></section>
      <section className="pipeline-callout"><div><span className="pipeline-icon">⇄</span><span><strong>Dữ liệu sẽ tự cập nhật từ box phone</strong><small>Collector → ảnh bằng chứng → OCR → hàng chờ xác minh → dashboard</small></span></div><a href="/scans">Xem luồng dữ liệu →</a></section>
    </div>
  </div>;
}
