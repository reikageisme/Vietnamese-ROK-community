"use client";

import Link from "next/link";
import { Badge, Card, SectionHeading } from "@/components/ui";
import { tools } from "@/data/mock-data";
import { useLocale } from "@/i18n/provider";
import { RokOfficialMark } from "@/components/rok-official-mark";

type HomeTopic = { slug: string; title: string; summary: string; author: string; category: Partial<Record<"vi" | "en", string>>; replyCount: number; updatedAt: string };
type HomeStats = { kingdoms: number; records: number; topics: number; members: number; campaign: { code: string; name: string; kingdoms: number } | null };

export function HomeContent({ stats, latest, hot }: { stats: HomeStats; latest: HomeTopic[]; hot: HomeTopic[] }) {
  const { locale, t } = useLocale();
  const campaign = stats.campaign;
  return <>
    <section className="hero"><div className="shell hero-inner">
      <div className="hero-copy"><p className="eyebrow"><i /> {t.heroEyebrow}</p><RokOfficialMark compact /><h1>Dữ liệu chiến trường.<br/><em>Tri thức cộng đồng.</em></h1><p className="hero-body">Forum, dữ liệu Kingdom, KvK và công cụ dành riêng cho cộng đồng Rise of Kingdoms Việt Nam — rõ nguồn, có lịch sử và có người xác minh.</p><div className="hero-actions"><Link className="button" href="/kingdoms">Khám phá dữ liệu</Link><Link className="button secondary" href="/forum">{t.exploreForum}</Link></div><div className="hero-trust"><span><i/> Cập nhật có lịch sử</span><span><i/> Community verified</span><span><i/> Việt / English</span></div></div>
      <div className="hero-panel" aria-label="Platform overview"><div className="command-board"><div className="board-top"><span><i/> COMMUNITY INTELLIGENCE</span><b>{campaign ? `#${campaign.code}` : "ROKVIET"}</b></div><div className="mini-map"><span className="map-ring ring-a"/><span className="map-ring ring-b"/><span className="map-core">KVK<small>HUB</small></span><span className="map-dot dot-a">A</span><span className="map-dot dot-b">B</span><span className="map-dot dot-c">C</span><span className="map-dot dot-d">D</span></div><div className="board-metrics"><span><small>Kingdoms</small><strong>{campaign?.kingdoms ?? stats.kingdoms}</strong></span><span><small>Data records</small><strong>{stats.records}</strong></span><span><small>Topics</small><strong>{stats.topics}</strong></span></div></div></div>
    </div></section>
    <section className="stats"><div className="shell stats-grid"><div><strong>{stats.kingdoms}</strong><span>Kingdom trong danh mục</span></div><div><strong>{stats.records}</strong><span>Dòng dữ liệu đã cập nhật</span></div><div><strong>{stats.topics}</strong><span>Thảo luận cộng đồng</span></div><div><strong>{stats.members}</strong><span>Thành viên</span></div></div></section>
    <div className="shell page-stack">
      <section><SectionHeading title="Trung tâm dữ liệu" href="/kingdoms" action="Mở dashboard" /><div className="home-data-grid"><Link className="home-feature-card kingdoms-feature" href="/kingdoms"><Badge>KINGDOM INTELLIGENCE</Badge><h2>Seed Ranking<br/>toàn cộng đồng</h2><p>So sánh dữ liệu tổng hợp và mức độ hoàn thiện của từng Kingdom.</p><span>Khám phá Kingdom →</span></Link><Link className="home-feature-card kvk-feature" href="/kvk"><Badge>KVK COMMAND CENTER</Badge><h2>Trại, phe và<br/>bản đồ chiến sự</h2><p>Theo dõi chiến dịch, camp và sức mạnh tổng hợp từ dữ liệu đã công bố.</p><span>Mở trung tâm KvK →</span></Link></div></section>
      <section><SectionHeading title={t.latestPatch} /><Card className="patch-card"><div><Badge>COMMUNITY BUILD</Badge><h2>{campaign ? `${campaign.name} · ${campaign.code}` : "RokViet Hub đang mở rộng dữ liệu"}</h2><p>Dashboard chỉ hiển thị dữ liệu đã lưu trong hệ thống; Kingdom chưa có dữ liệu được ghi rõ thay vì dùng số liệu minh họa.</p></div><span className="patch-number">RV</span></Card></section>
      <section><SectionHeading title={t.featured} href="/forum" action={t.viewAll} /><div className="two-column">{latest.length ? latest.map((post) => <Card key={post.slug} className="article-card"><Badge>{post.category[locale] ?? post.category.vi ?? "Cộng đồng"}</Badge><h3>{post.title}</h3><p>{post.summary}</p><div className="article-meta"><span>{post.author}</span><span>·</span><span>{new Date(post.updatedAt).toLocaleDateString("vi-VN")}</span></div><Link href={`/forum/topic/${post.slug}`}>{t.readMore} →</Link></Card>) : <Card className="article-card"><h3>Chưa có bài nổi bật</h3><p>Hãy là người đầu tiên chia sẻ kinh nghiệm với cộng đồng.</p><Link href="/forum">Mở diễn đàn →</Link></Card>}</div></section>
      <section className="home-columns"><div><SectionHeading title={t.hotQuestions} href="/forum" action={t.viewAll} /><Card className="discussion-list">{hot.length ? hot.map((item) => <Link href={`/forum/topic/${item.slug}`} className="discussion" key={item.slug}><div><Badge>{item.category[locale] ?? item.category.vi ?? "Forum"}</Badge><h3>{item.title}</h3></div><div className="reply-count"><strong>{item.replyCount}</strong><span>{t.replies}</span></div></Link>) : <p className="empty-state">Chưa có thảo luận.</p>}</Card></div><div><SectionHeading title={t.quickTools} href="/tools" action={t.viewAll} /><Card className="quick-tools">{tools.slice(0, 3).map((tool) => <Link href={tool.available ? `/tools/${tool.slug}` : "/tools"} key={tool.slug}><span className="tool-mark">{tool.mark}</span><span><strong>{tool.name[locale]}</strong><small>{tool.description[locale]}</small></span><span>→</span></Link>)}</Card></div></section>
    </div>
  </>;
}
