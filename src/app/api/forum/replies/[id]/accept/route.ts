import { prisma } from "@/lib/prisma";
import { requireAuth, AuthorizationError } from "@/lib/auth-guards";
import { forumError } from "@/modules/forum/http";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(); const { id } = await context.params;
    const reply = await prisma.reply.findFirst({ where: { id, deletedAt: null }, select: { id: true, authorId: true, topicId: true, topic: { select: { authorId: true, deletedAt: true, acceptedReplyId: true } } } });
    if (!reply || reply.topic.deletedAt) return Response.json({ error: "Không tìm thấy câu trả lời." }, { status: 404 });
    if (reply.topic.authorId !== session.user.id) throw new AuthorizationError("Chỉ tác giả chủ đề được chọn câu trả lời đúng.");
    if (reply.topic.acceptedReplyId === id) return Response.json({ acceptedReplyId: id });
    await prisma.$transaction(async (tx) => {
      if (reply.topic.acceptedReplyId) {
        const previous = await tx.reply.findUnique({ where: { id: reply.topic.acceptedReplyId }, select: { authorId: true } });
        await tx.reply.update({ where: { id: reply.topic.acceptedReplyId }, data: { isAcceptedAnswer: false } });
        if (previous) await tx.reputationEvent.create({ data: { userId: previous.authorId, reason: "ACCEPTED_ANSWER_REVERSED", points: -15, sourceRef: `reply:${reply.topic.acceptedReplyId}:unaccepted` } });
      }
      await tx.topic.update({ where: { id: reply.topicId }, data: { acceptedReplyId: id } });
      await tx.reply.update({ where: { id }, data: { isAcceptedAnswer: true } });
      await tx.reputationEvent.create({ data: { userId: reply.authorId, reason: "ACCEPTED_ANSWER", points: 15, sourceRef: `reply:${id}:accepted` } });
      if (reply.authorId !== session.user.id) await tx.forumNotification.create({ data: { userId: reply.authorId, actorId: session.user.id, type: "ACCEPTED_ANSWER", topicId: reply.topicId, replyId: id } });
    });
    return Response.json({ acceptedReplyId: id });
  } catch (error) { return forumError(error); }
}
