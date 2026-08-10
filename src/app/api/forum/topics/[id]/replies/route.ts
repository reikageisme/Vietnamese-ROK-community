import { prisma } from "@/lib/prisma";
import { requireVerifiedContributor } from "@/lib/auth-guards";
import { forumError } from "@/modules/forum/http";
import { createReplySchema } from "@/modules/forum/schemas";
import { isForumModerator, replyRateLimited } from "@/modules/forum/permissions";
import { extractMentions, mentionRecipientIds, normalizeReplyParent } from "@/modules/forum/logic";
import { renderForumMarkdown } from "@/modules/forum/markdown";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireVerifiedContributor(); const { id } = await context.params; const input = createReplySchema.parse(await request.json());
    const topic = await prisma.topic.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, authorId: true, categoryId: true, isLocked: true, subscriptions: { select: { userId: true } } },
    });
    if (!topic) return Response.json({ error: "Không tìm thấy chủ đề." }, { status: 404 });
    if (topic.isLocked && !isForumModerator(session.user.role)) return Response.json({ error: "Chủ đề đã bị khóa." }, { status: 409 });
    const recentCount = await prisma.reply.count({ where: { authorId: session.user.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } });
    if (replyRateLimited(session.user.role, recentCount)) {
      const limit = session.user.role === "CONTRIBUTOR" ? 60 : 20;
      return Response.json({ error: `Bạn đã đạt giới hạn ${limit} câu trả lời mỗi giờ.` }, { status: 429 });
    }
    const parent = input.parentReplyId ? await prisma.reply.findFirst({ where: { id: input.parentReplyId, topicId: id, deletedAt: null }, select: { id: true, parentId: true, authorId: true } }) : null;
    if (input.parentReplyId && !parent) return Response.json({ error: "Không tìm thấy câu trả lời cha." }, { status: 404 });
    const parentId = normalizeReplyParent(parent);
    const mentionNames = extractMentions(input.bodyMarkdown);
    const mentionedUsers = mentionNames.length ? await prisma.user.findMany({
      where: { OR: mentionNames.flatMap((name) => [{ displayName: { equals: name, mode: "insensitive" as const } }, { name: { equals: name, mode: "insensitive" as const } }]) },
      select: { id: true },
    }) : [];
    const bodyHtml = await renderForumMarkdown(input.bodyMarkdown); const now = new Date();
    const reply = await prisma.$transaction(async (tx) => {
      const created = await tx.reply.create({ data: { topicId: id, authorId: session.user.id, parentId, body: input.bodyMarkdown, bodyHtml } });
      await tx.topic.update({ where: { id }, data: { replyCount: { increment: 1 }, lastReplyAt: now, lastReplyById: session.user.id } });
      await tx.category.update({ where: { id: topic.categoryId }, data: { lastActivityAt: now } });

      const mentionIds = new Set(mentionRecipientIds(mentionedUsers.map((user) => user.id), session.user.id));
      const mentions = mentionedUsers.filter((user) => mentionIds.has(user.id));
      if (mentions.length) {
        await tx.forumMention.createMany({ data: mentions.map((user) => ({ replyId: created.id, mentionedUserId: user.id })), skipDuplicates: true });
        await tx.forumNotification.createMany({ data: mentions.map((user) => ({ userId: user.id, actorId: session.user.id, type: "MENTION", topicId: id, replyId: created.id })) });
      }

      const recipients = new Map<string, "REPLY_TO_TOPIC" | "REPLY_TO_YOUR_REPLY">();
      if (topic.authorId !== session.user.id) recipients.set(topic.authorId, "REPLY_TO_TOPIC");
      for (const subscription of topic.subscriptions) if (subscription.userId !== session.user.id) recipients.set(subscription.userId, "REPLY_TO_TOPIC");
      if (parent?.authorId && parent.authorId !== session.user.id) recipients.set(parent.authorId, "REPLY_TO_YOUR_REPLY");
      for (const mentioned of mentions) recipients.delete(mentioned.id);
      if (recipients.size) await tx.forumNotification.createMany({ data: [...recipients].map(([userId, type]) => ({ userId, actorId: session.user.id, type, topicId: id, replyId: created.id })) });
      return created;
    });
    return Response.json({ reply }, { status: 201 });
  } catch (error) { return forumError(error); }
}
