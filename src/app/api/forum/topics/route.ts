import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireVerifiedContributor } from "@/lib/auth-guards";
import { forumError } from "@/modules/forum/http";
import { createTopicSchema, listTopicsSchema } from "@/modules/forum/schemas";
import { topicRateLimited } from "@/modules/forum/permissions";
import { replaceTopicTags } from "@/modules/forum/tags";
import { renderForumMarkdown } from "@/modules/forum/markdown";

function publicTopic(topic: Record<string, unknown> & { tags: Array<{ isVerifiedTag: boolean; tag: { slug: string } }> }) {
  return { ...topic, tags: topic.tags.map((item) => ({ slug: item.tag.slug, isVerified: item.isVerifiedTag })) };
}

export async function GET(request: Request) {
  try {
    const input = listTopicsSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const where: Prisma.TopicWhereInput = {
      deletedAt: null,
      status: "PUBLISHED",
      ...(input.category ? { category: { slug: input.category } } : {}),
      ...(input.tag ? { tags: { some: { tag: { slug: input.tag } } } } : {}),
      ...(input.sort === "unanswered" ? { replyCount: 0 } : {}),
    };
    const orderBy: Prisma.TopicOrderByWithRelationInput[] = input.sort === "top"
      ? [{ isPinned: "desc" }, { upvoteCount: "desc" }, { downvoteCount: "asc" }, { updatedAt: "desc" }]
      : [{ isPinned: "desc" }, { lastReplyAt: "desc" }, { createdAt: "desc" }];
    const [total, topics] = await prisma.$transaction([
      prisma.topic.count({ where }),
      prisma.topic.findMany({
        where, skip: (input.page - 1) * input.pageSize, take: input.pageSize, orderBy,
        include: { category: { select: { slug: true } }, author: { select: { id: true, displayName: true, name: true, image: true } }, tags: { include: { tag: { select: { slug: true } } } } },
      }),
    ]);
    return Response.json({ page: input.page, pageSize: input.pageSize, total, pages: Math.ceil(total / input.pageSize), topics: topics.map(publicTopic) });
  } catch (error) { return forumError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await requireVerifiedContributor();
    const input = createTopicSchema.parse(await request.json());
    const category = await prisma.category.findUnique({ where: { slug: input.categorySlug }, select: { id: true } });
    if (!category) return Response.json({ error: "Không tìm thấy chuyên mục." }, { status: 404 });
    const recentCount = await prisma.topic.count({ where: { authorId: session.user.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } });
    if (topicRateLimited(session.user.role, recentCount)) return Response.json({ error: "Bạn đã đạt giới hạn 5 chủ đề mỗi giờ." }, { status: 429 });
    const bodyHtml = await renderForumMarkdown(input.bodyMarkdown);
    const slugBase = input.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "topic";
    const now = new Date();
    const topic = await prisma.$transaction(async (tx) => {
      const created = await tx.topic.create({ data: { categoryId: category.id, authorId: session.user.id, title: input.title, body: input.bodyMarkdown, bodyHtml, slug: `${slugBase}-${randomUUID().slice(0, 8)}` } });
      await replaceTopicTags(tx, created.id, input.tags);
      await tx.category.update({ where: { id: category.id }, data: { topicCount: { increment: 1 }, lastActivityAt: now } });
      return created;
    });
    return Response.json({ topic }, { status: 201 });
  } catch (error) { return forumError(error); }
}
