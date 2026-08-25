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
  // Ngày tháng theo đúng ngôn ngữ đang chọn — trước đây khoá cứng vi-VN nên bản
  // tiếng Anh vẫn hiện ngày kiểu Việt.
  const dateLocale = locale === "vi" ? "vi-VN" : "en-GB";

  return <>
    <section className="hero"><div className="shell hero-inner">
      <div className="hero-copy">
        <p className="eyebrow"><i /> {t.heroEyebrow}</p>
        <RokOfficialMark compact />
        <h1>{t.heroTitleA}<br/><em>{t.heroTitleB}</em></h1>
        <p className="hero-body">{t.heroBodyMain}</p>
        <div className="hero-actions">
          <Link className="button" href="/kingdoms">{t.heroCtaData}</Link>
          <Link className="button secondary" href="/forum">{t.exploreForum}</Link>
        </div>
        <div className="hero-trust"><span><i/> {t.trustHistory}</span><span><i/> {t.trustVerified}</span><span><i/> {t.trustBilingual}</span></div>
      </div>
      <div className="hero-panel" aria-label="ROK FAQ">
        <div className="command-board">
          <div className="board-top"><span><i/> {t.kingdomBadge}</span><b>{campaign ? `#${campaign.code}` : "ROK FAQ"}</b></div>
          <div className="mini-map"><span className="map-ring ring-a"/><span className="map-ring ring-b"/><span className="map-core">KVK<small>MAP</small></span><span className="map-dot dot-a">A</span><span className="map-dot dot-b">B</span><span className="map-dot dot-c">C</span><span className="map-dot dot-d">D</span></div>
          <div className="board-metrics">
            <span><small>{t.boardKingdoms}</small><strong>{campaign?.kingdoms ?? stats.kingdoms}</strong></span>
            <span><small>{t.boardRecords}</small><strong>{stats.records}</strong></span>
            <span><small>{t.boardTopics}</small><strong>{stats.topics}</strong></span>
          </div>
        </div>
      </div>
    </div></section>

    <section className="stats"><div className="shell stats-grid">
      <div><strong>{stats.kingdoms}</strong><span>{t.statKingdoms}</span></div>
      <div><strong>{stats.records}</strong><span>{t.statRecords}</span></div>
      <div><strong>{stats.topics}</strong><span>{t.statTopics}</span></div>
      <div><strong>{stats.members}</strong><span>{t.statMembers}</span></div>
    </div></section>

    <div className="shell page-stack">
      <section>
        <SectionHeading title={t.dataCenter} href="/kingdoms" action={t.openDashboard} />
        <div className="home-data-grid">
          <Link className="home-feature-card kingdoms-feature" href="/kingdoms">
            <Badge>{t.kingdomBadge}</Badge>
            <h2>{t.kingdomTitleA}<br/>{t.kingdomTitleB}</h2>
            <p>{t.kingdomBody}</p>
            <span>{t.kingdomCta}</span>
          </Link>
          <Link className="home-feature-card kvk-feature" href="/kvk">
            <Badge>{t.kvkBadge}</Badge>
            <h2>{t.kvkTitleA}<br/>{t.kvkTitleB}</h2>
            <p>{t.kvkBody}</p>
            <span>{t.kvkCta}</span>
          </Link>
        </div>
      </section>

      <section>
        <SectionHeading title={t.latestPatch} />
        <Card className="patch-card">
          <div>
            <Badge>{t.buildBadge}</Badge>
            <h2>{campaign ? `${campaign.name} · ${campaign.code}` : t.patchEmptyTitle}</h2>
            <p>{t.patchEmptyBody}</p>
          </div>
          <span className="patch-number">RF</span>
        </Card>
      </section>

      <section>
        <SectionHeading title={t.featured} href="/forum" action={t.viewAll} />
        <div className="two-column">
          {latest.length ? latest.map((post) => (
            <Card key={post.slug} className="article-card">
              <Badge>{post.category[locale] ?? post.category.vi ?? t.categoryFallback}</Badge>
              <h3>{post.title}</h3>
              <p>{post.summary}</p>
              <div className="article-meta"><span>{post.author}</span><span>·</span><span>{new Date(post.updatedAt).toLocaleDateString(dateLocale)}</span></div>
              <Link href={`/forum/topic/${post.slug}`}>{t.readMore} →</Link>
            </Card>
          )) : (
            <Card className="article-card">
              <h3>{t.emptyFeaturedTitle}</h3>
              <p>{t.emptyFeaturedBody}</p>
              <Link href="/forum">{t.emptyFeaturedCta}</Link>
            </Card>
          )}
        </div>
      </section>

      <section className="home-columns">
        <div>
          <SectionHeading title={t.hotQuestions} href="/forum" action={t.viewAll} />
          <Card className="discussion-list">
            {hot.length ? hot.map((item) => (
              <Link href={`/forum/topic/${item.slug}`} className="discussion" key={item.slug}>
                <div><Badge>{item.category[locale] ?? item.category.vi ?? t.categoryFallback}</Badge><h3>{item.title}</h3></div>
                <div className="reply-count"><strong>{item.replyCount}</strong><span>{t.replies}</span></div>
              </Link>
            )) : <p className="empty-state">{t.emptyDiscussions}</p>}
          </Card>
        </div>
        <div>
          <SectionHeading title={t.quickTools} href="/tools" action={t.viewAll} />
          <Card className="quick-tools">
            {tools.slice(0, 3).map((tool) => (
              <Link href={tool.available ? `/tools/${tool.slug}` : "/tools"} key={tool.slug}>
                <span className="tool-mark">{tool.mark}</span>
                <span><strong>{tool.name[locale]}</strong><small>{tool.description[locale]}</small></span>
                <span>→</span>
              </Link>
            ))}
          </Card>
        </div>
      </section>
    </div>
  </>;
}
