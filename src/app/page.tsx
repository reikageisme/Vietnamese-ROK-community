"use client";

import Link from "next/link";
import { Badge, Card, SectionHeading } from "@/components/ui";
import { discussions, featuredPosts, tools } from "@/data/mock-data";
import { formatCompact, kingdoms } from "@/data/kingdom-demo";
import { useLocale } from "@/i18n/provider";
import { RokOfficialMark } from "@/components/rok-official-mark";

export default function HomePage() {
  const { locale, t } = useLocale();
  return (
    <>
      <section className="hero"><div className="shell hero-inner">
        <div className="hero-copy"><p className="eyebrow"><i /> {t.heroEyebrow}</p><RokOfficialMark compact /><h1>Dữ liệu chiến trường.<br/><em>Tri thức cộng đồng.</em></h1><p className="hero-body">Forum, dữ liệu Kingdom, KvK và công cụ dành riêng cho cộng đồng Rise of Kingdoms Việt Nam — có nguồn, có lịch sử và có người xác minh.</p><div className="hero-actions"><Link className="button" href="/kingdoms">Khám phá dữ liệu</Link><Link className="button secondary" href="/forum">{t.exploreForum}</Link></div><div className="hero-trust"><span><i/> Dữ liệu có nguồn</span><span><i/> Community verified</span><span><i/> Việt / English</span></div></div>
        <div className="hero-panel" aria-label="Platform overview">
          <div className="command-board"><div className="board-top"><span><i/> LIVE INTELLIGENCE</span><b>#C13273</b></div><div className="mini-map"><span className="map-ring ring-a"/><span className="map-ring ring-b"/><span className="map-core">KVK<small>MAP</small></span><span className="map-dot dot-a">A</span><span className="map-dot dot-b">B</span><span className="map-dot dot-c">C</span><span className="map-dot dot-d">D</span></div><div className="board-metrics"><span><small>Kingdoms</small><strong>32/32</strong></span><span><small>Scan coverage</small><strong>94%</strong></span><span><small>Governors</small><strong>9.6K</strong></span></div></div>
        </div>
      </div></section>
      <section className="stats"><div className="shell stats-grid"><div><strong>{kingdoms.length}</strong><span>Kingdom đang theo dõi</span></div><div><strong>{formatCompact(kingdoms.reduce((sum, item) => sum + item.power, 0))}</strong><span>Tổng lực chiến demo</span></div><div><strong>03</strong><span>Gói dữ liệu theo yêu cầu</span></div><div><strong>94%</strong><span>Độ phủ trung bình</span></div></div></section>
      <div className="shell page-stack">
        <section><SectionHeading title="Trung tâm dữ liệu" href="/kingdoms" action="Mở dashboard" /><div className="home-data-grid"><Link className="home-feature-card kingdoms-feature" href="/kingdoms"><Badge>KINGDOM INTELLIGENCE</Badge><h2>Seed Ranking<br/>toàn cộng đồng</h2><p>So sánh lực chiến, KP, quân chết, T4/T5 và độ phủ của từng lượt quét.</p><span>Khám phá Kingdom →</span></Link><Link className="home-feature-card kvk-feature" href="/kvk"><Badge>KVK COMMAND CENTER</Badge><h2>Trại, phe và<br/>bản đồ chiến sự</h2><p>Nhóm kingdom theo camp, theo dõi tiến trình và sức mạnh tổng hợp.</p><span>Mở trung tâm KvK →</span></Link><Link className="home-feature-card scan-feature" href="/scans"><Badge>DỊCH VỤ QUÉT</Badge><h2>Yêu cầu dữ liệu<br/>theo Kingdom</h2><p>Nạp credit, chọn gói quét và theo dõi tiến độ riêng trong tài khoản.</p><span>Yêu cầu quét →</span></Link></div></section>
        <section><SectionHeading title={t.latestPatch} /><Card className="patch-card"><div><Badge>BUILD · 08.2026</Badge><h2>RokViet Data Hub — nền tảng thử nghiệm</h2><p>Dashboard hiện dùng dữ liệu minh họa. Khi collector hoạt động, mỗi batch sẽ lưu thiết bị, thời gian, ảnh bằng chứng và trạng thái xác minh.</p></div><span className="patch-number">02</span></Card></section>
        <section><SectionHeading title={t.featured} href="/forum" action={t.viewAll} /><div className="two-column">{featuredPosts.map((post) => <Card key={post.title.vi} className="article-card"><Badge>{post.category[locale]}</Badge><h3>{post.title[locale]}</h3><p>{post.summary[locale]}</p><div className="article-meta"><span>{post.author}</span><span>·</span><span>{post.time}</span></div><Link href="/forum">{t.readMore} →</Link></Card>)}</div></section>
        <section className="home-columns"><div><SectionHeading title={t.hotQuestions} href="/forum" action={t.viewAll} /><Card className="discussion-list">{discussions.map((item) => <Link href="/forum" className="discussion" key={item.title.vi}><div><Badge>{item.category[locale]}</Badge><h3>{item.title[locale]}</h3></div><div className="reply-count"><strong>{item.replies}</strong><span>{t.replies}</span></div></Link>)}</Card></div><div><SectionHeading title={t.quickTools} href="/tools" action={t.viewAll} /><Card className="quick-tools">{tools.slice(0, 3).map((tool) => <Link href={tool.available ? `/tools/${tool.slug}` : "/tools"} key={tool.slug}><span className="tool-mark">{tool.mark}</span><span><strong>{tool.name[locale]}</strong><small>{tool.description[locale]}</small></span><span>→</span></Link>)}</Card></div></section>
      </div>
    </>
  );
}
