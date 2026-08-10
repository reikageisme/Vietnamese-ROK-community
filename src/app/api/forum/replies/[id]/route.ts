import { prisma } from "@/lib/prisma";
import { requireAuth, AuthorizationError } from "@/lib/auth-guards";
import { forumError } from "@/modules/forum/http";
import { updateReplySchema } from "@/modules/forum/schemas";
import { canEditForumContent, isForumModerator } from "@/modules/forum/permissions";
import { renderForumMarkdown } from "@/modules/forum/markdown";
import { replyDeletionTopicData } from "@/modules/forum/logic";
import { extractMentions, mentionRecipientIds } from "@/modules/forum/logic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(); const { id } = await context.params; const input = updateReplySchema.parse(await request.json());
    const reply = await prisma.reply.findUnique({ where: { id }, select: { authorId: true, topicId: true, body: true, createdAt: true, deletedAt: true } });
    if (!reply || reply.deletedAt) return Response.json({ error: "Không tìm thấy câu trả lời." }, { status: 404 });
    if (!canEditForumContent(session.user, reply.authorId, reply.createdAt)) throw new AuthorizationError("Chỉ được sửa câu trả lời của mình trong 30 phút đầu.");
    const bodyHtml = await renderForumMarkdown(input.bodyMarkdown);
    const names = extractMentions(input.bodyMarkdown);
    const users = names.length ? await prisma.user.findMany({ where: { OR: names.flatMap((name) => [{ displayName: { equals: name, mode: "insensitive" as const } }, { name: { equals: name, mode: "insensitive" as const } }]) }, select: { id: true } }) : [];
    const mentionIds = mentionRecipientIds(users.map((user) => user.id), session.user.id);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.forumEditHistory.create({ data: { targetType: "REPLY", replyId: id, editedById: session.user.id, previousBody: reply.body } });
      const previousMentions = await tx.forumMention.findMany({ where: { replyId: id }, select: { mentionedUserId: true } });
      await tx.forumMention.deleteMany({ where: { replyId: id } });
      if (mentionIds.length) await tx.forumMention.createMany({ data: mentionIds.map((mentionedUserId) => ({ replyId: id, mentionedUserId })), skipDuplicates: true });
      const previousIds = new Set(previousMentions.map((item) => item.mentionedUserId));
      const newIds = mentionIds.filter((userId) => !previousIds.has(userId));
      if (newIds.length) await tx.forumNotification.createMany({ data: newIds.map((userId) => ({ userId, actorId: session.user.id, type: "MENTION", topicId: reply.topicId, replyId: id })) });
      return tx.reply.update({ where: { id }, data: { body: input.bodyMarkdown, bodyHtml } });
    });
    return Response.json({ reply: updated });
  } catch (error) { return forumError(error); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(); const { id } = await context.params;
    const reply = await prisma.reply.findUnique({ where: { id }, select: { authorId: true, topicId: true, deletedAt: true, isAcceptedAnswer: true, topic: { select: { categoryId: true, createdAt: true } } } });
    if (!reply || reply.deletedAt) return Response.json({ error: "Không tìm thấy câu trả lời." }, { status: 404 });
    if (session.user.id !== reply.authorId && !isForumModerator(session.user.role)) throw new AuthorizationError("Không có quyền xóa câu trả lời.");
    await prisma.$transaction(async (tx) => {
      await tx.reply.update({ where: { id }, data: { deletedAt: new Date(), status: "REMOVED", isAcceptedAnswer: false } });
      const latest = await tx.reply.findFirst({ where: { topicId: reply.topicId, deletedAt: null }, orderBy: { createdAt: "desc" }, select: { createdAt: true, authorId: true } });
      await tx.topic.update({ where: { id: reply.topicId }, data: { ...replyDeletionTopicData(reply.isAcceptedAnswer), lastReplyAt: latest?.createdAt ?? null, lastReplyById: latest?.authorId ?? null } });
      await tx.category.update({ where: { id: reply.topic.categoryId }, data: { lastActivityAt: latest?.createdAt ?? reply.topic.createdAt } });
      if (reply.isAcceptedAnswer) await tx.reputationEvent.create({ data: { userId: reply.authorId, reason: "ACCEPTED_ANSWER_REVERSED", points: -15, sourceRef: `reply:${id}:deleted` } });
      if (isForumModerator(session.user.role)) await tx.forumModerationAuditLog.create({ data: { moderatorId: session.user.id, action: "DELETE_REPLY", targetType: "REPLY", targetId: id } });
    });
    return new Response(null, { status: 204 });
  } catch (error) { return forumError(error); }
}
