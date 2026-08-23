import { HomeContent } from "@/components/home-content";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function categoryNames(translations: Array<{ locale: "vi" | "en"; value: string }>) {
  return Object.fromEntries(translations.map((item) => [item.locale, item.value]));
}

function topicCard(topic: {
  slug: string; title: string; body: string; replyCount: number; updatedAt: Date;
  author: { displayName: string | null; name: string | null };
  category: { name: { translations: Array<{ locale: "vi" | "en"; value: string }> } };
}) {
  return { slug: topic.slug, title: topic.title, summary: topic.body.replace(/[#>*_`\[\]]/g, "").slice(0, 180), author: topic.author.displayName ?? topic.author.name ?? "Thành viên", category: categoryNames(topic.category.name.translations), replyCount: topic.replyCount, updatedAt: topic.updatedAt.toISOString() };
}

export default async function HomePage() {
  const topicInclude = { author: { select: { displayName: true, name: true } }, category: { select: { name: { select: { translations: { select: { locale: true, value: true } } } } } } } as const;
  const [kingdoms, records, topics, members, latest, hot, campaign] = await Promise.all([
    prisma.kingdom.count(),
    prisma.rankingScanEntry.count(),
    prisma.topic.count({ where: { deletedAt: null, status: "PUBLISHED" } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.topic.findMany({ where: { deletedAt: null, status: "PUBLISHED" }, orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }], take: 2, include: topicInclude }),
    prisma.topic.findMany({ where: { deletedAt: null, status: "PUBLISHED" }, orderBy: [{ upvoteCount: "desc" }, { replyCount: "desc" }, { updatedAt: "desc" }], take: 3, include: topicInclude }),
    prisma.kvkCampaign.findFirst({ where: { status: "ACTIVE" }, orderBy: { startsAt: "desc" }, include: { camps: { include: { _count: { select: { kingdoms: true } } } } } }),
  ]);
  return <HomeContent stats={{ kingdoms, records, topics, members, campaign: campaign ? { code: campaign.code, name: campaign.name, kingdoms: campaign.camps.reduce((sum, camp) => sum + camp._count.kingdoms, 0) } : null }} latest={latest.map(topicCard)} hot={hot.map(topicCard)} />;
}
