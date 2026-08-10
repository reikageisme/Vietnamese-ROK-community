import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthorizationError } from "@/lib/auth-guards";
import { forumError } from "@/modules/forum/http";
import { updateTopicSchema } from "@/modules/forum/schemas";
import { canEditForumContent, isForumModerator } from "@/modules/forum/permissions";
import { replaceTopicTags } from "@/modules/forum/tags";
import { renderForumMarkdown } from "@/modules/forum/markdown";

const authorSelect = { id: true, displayName: true, name: true, image: true } as const;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, session] = await Promise.all([context.params, auth()]);
    const topic = await prisma.topic.findFirst({
      where: { OR: [{ id }, { slug: id }], deletedAt: null, status: { not: "REMOVED" } },
      include: {
        category: { select: { slug: true } }, author: { select: authorSelect },
        tags: { include: { tag: { select: { slug: true } } } },
        editHistory: { orderBy: { editedAt: "desc" }, take: 1, select: { editedAt: true } },
        replies: {
          where: { deletedAt: null }, orderBy: { createdAt: "asc" },
          include: { author: { select: authorSelect }, editHistory: { orderBy: { editedAt: "desc" }, take: 1, select: { editedAt: true } }, ...(session?.user?.id ? { votes: { where: { userId: session.user.id }, select: { value: true } } } : {}) },
        },
        ...(session?.user?.id ? { bookmarks: { where: { userId: session.user.id }, select: { id: true } }, subscriptions: { where: { userId: session.user.id }, select: { id: true } }, votes: { where: { userId: session.user.id }, select: { value: true } } } : {}),
      },
    });
    if (!topic) return Response.json({ error: "Không tìm thấy chủ đề." }, { status: 404 });
    const data = topic as typeof topic & { bookmarks?: unknown[]; subscriptions?: unknown[]; votes?: Array<{ value: number }> };
    return Response.json({
      ...data,
      score: topic.upvoteCount - topic.downvoteCount,
      tags: topic.tags.map((item) => ({ slug: item.tag.slug, isVerified: item.isVerifiedTag })),
      editedAt: topic.editHistory[0]?.editedAt ?? null,
      replies: topic.replies.map((reply) => { const item = reply as typeof reply & { votes?: Array<{ value: number }> }; return { ...item, votes: undefined, score: reply.upvoteCount - reply.downvoteCount, editedAt: reply.editHistory[0]?.editedAt ?? null, viewerVote: item.votes?.[0]?.value ?? null }; }),
      viewer: { vote: data.votes?.[0]?.value ?? null, bookmarked: Boolean(data.bookmarks?.length), subscribed: Boolean(data.subscriptions?.length) },
      bookmarks: undefined, subscriptions: undefined, votes: undefined,
    });
  } catch (error) { return forumError(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(); const { id } = await context.params; const input = updateTopicSchema.parse(await request.json());
    const topic = await prisma.topic.findUnique({ where: { id }, select: { authorId: true, body: true, createdAt: true, deletedAt: true } });
    if (!topic || topic.deletedAt) return Response.json({ error: "Không tìm thấy chủ đề." }, { status: 404 });
    if (!canEditForumContent(session.user, topic.authorId, topic.createdAt)) throw new AuthorizationError("Chỉ được sửa bài của mình trong 30 phút đầu.");
    const bodyHtml = input.bodyMarkdown ? await renderForumMarkdown(input.bodyMarkdown) : undefined;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.forumEditHistory.create({ data: { targetType: "TOPIC", topicId: id, editedById: session.user.id, previousBody: topic.body } });
      const result = await tx.topic.update({ where: { id }, data: { title: input.title, body: input.bodyMarkdown, bodyHtml } });
      if (input.tags) await replaceTopicTags(tx, id, input.tags);
      return result;
    });
    return Response.json({ topic: updated });
  } catch (error) { return forumError(error); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(); const { id } = await context.params;
    const topic = await prisma.topic.findUnique({ where: { id }, select: { authorId: true, categoryId: true, deletedAt: true } });
    if (!topic || topic.deletedAt) return Response.json({ error: "Không tìm thấy chủ đề." }, { status: 404 });
    if (session.user.id !== topic.authorId && !isForumModerator(session.user.role)) throw new AuthorizationError("Không có quyền xóa chủ đề.");
    await prisma.$transaction(async (tx) => {
      await tx.topic.update({ where: { id }, data: { deletedAt: new Date(), status: "REMOVED", acceptedReplyId: null } });
      const latest = await tx.topic.findFirst({ where: { categoryId: topic.categoryId, deletedAt: null }, orderBy: [{ lastReplyAt: "desc" }, { createdAt: "desc" }], select: { lastReplyAt: true, createdAt: true } });
      await tx.category.update({ where: { id: topic.categoryId }, data: { topicCount: { decrement: 1 }, lastActivityAt: latest?.lastReplyAt ?? latest?.createdAt ?? null } });
      if (isForumModerator(session.user.role)) await tx.forumModerationAuditLog.create({ data: { moderatorId: session.user.id, action: "DELETE_TOPIC", targetType: "TOPIC", targetId: id } });
    });
    return new Response(null, { status: 204 });
  } catch (error) { return forumError(error); }
}
