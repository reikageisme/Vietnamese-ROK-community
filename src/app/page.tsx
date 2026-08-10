"use client";

import Link from "next/link";
import { Badge, Card, SectionHeading } from "@/components/ui";
import { discussions, featuredPosts, tools } from "@/data/mock-data";
import { useLocale } from "@/i18n/provider";

export default function HomePage() {
  const { locale, t } = useLocale();
  return (
    <>
      <section className="hero"><div className="shell hero-inner">
        <div className="hero-copy"><p className="eyebrow">{t.heroEyebrow}</p><h1>{t.heroTitle}</h1><p className="hero-body">{t.heroBody}</p><div className="hero-actions"><Link className="button" href="/forum">{t.exploreForum}</Link><Link className="button secondary" href="/tools">{t.openTools}</Link></div></div>
        <div className="hero-panel" aria-label="Platform overview">
          <div className="hub-orbit"><span className="hub-core">RV</span><span className="orbit-item orbit-a">FORUM</span><span className="orbit-item orbit-b">CODEX</span><span className="orbit-item orbit-c">TOOLS</span></div>
        </div>
      </div></section>
      <section className="stats"><div className="shell stats-grid"><div><strong>08</strong><span>{t.communityStat}</span></div><div><strong>20+</strong><span>{t.knowledgeStat}</span></div><div><strong>06</strong><span>{t.toolStat}</span></div></div></section>
      <div className="shell page-stack">
        <section><SectionHeading title={t.latestPatch} /><Card className="patch-card"><div><Badge>PATCH NOTES · 08.2026</Badge><h2>Ghi chú cập nhật cộng đồng — bản thử nghiệm đầu tiên</h2><p>RokViet Hub đang hoàn thiện dữ liệu mẫu và quy trình đóng góp minh bạch. Mọi số liệu sẽ hiển thị nguồn và ngày kiểm tra.</p></div><span className="patch-number">01</span></Card></section>
        <section><SectionHeading title={t.featured} href="/forum" action={t.viewAll} /><div className="two-column">{featuredPosts.map((post) => <Card key={post.title.vi} className="article-card"><Badge>{post.category[locale]}</Badge><h3>{post.title[locale]}</h3><p>{post.summary[locale]}</p><div className="article-meta"><span>{post.author}</span><span>·</span><span>{post.time}</span></div><Link href="/forum">{t.readMore} →</Link></Card>)}</div></section>
        <section className="home-columns"><div><SectionHeading title={t.hotQuestions} href="/forum" action={t.viewAll} /><Card className="discussion-list">{discussions.map((item) => <Link href="/forum" className="discussion" key={item.title.vi}><div><Badge>{item.category[locale]}</Badge><h3>{item.title[locale]}</h3></div><div className="reply-count"><strong>{item.replies}</strong><span>{t.replies}</span></div></Link>)}</Card></div><div><SectionHeading title={t.quickTools} href="/tools" action={t.viewAll} /><Card className="quick-tools">{tools.slice(0, 3).map((tool) => <Link href={tool.available ? `/tools/${tool.slug}` : "/tools"} key={tool.slug}><span className="tool-mark">{tool.mark}</span><span><strong>{tool.name[locale]}</strong><small>{tool.description[locale]}</small></span><span>→</span></Link>)}</Card></div></section>
      </div>
    </>
  );
}
