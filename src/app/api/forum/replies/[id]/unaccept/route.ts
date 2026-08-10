import { prisma } from "@/lib/prisma";
import { requireAuth, AuthorizationError } from "@/lib/auth-guards";
import { forumError } from "@/modules/forum/http";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(); const { id } = await context.params;
    const reply = await prisma.reply.findUnique({ where: { id }, select: { authorId: true, topicId: true, isAcceptedAnswer: true, topic: { select: { authorId: true } } } });
    if (!reply) return Response.json({ error: "Không tìm thấy câu trả lời." }, { status: 404 });
    if (reply.topic.authorId !== session.user.id) throw new AuthorizationError("Chỉ tác giả chủ đề được bỏ chọn câu trả lời.");
    if (!reply.isAcceptedAnswer) return Response.json({ acceptedReplyId: null });
    await prisma.$transaction([
      prisma.reply.update({ where: { id }, data: { isAcceptedAnswer: false } }),
      prisma.topic.update({ where: { id: reply.topicId }, data: { acceptedReplyId: null } }),
      prisma.reputationEvent.create({ data: { userId: reply.authorId, reason: "ACCEPTED_ANSWER_REVERSED", points: -15, sourceRef: `reply:${id}:unaccepted` } }),
    ]);
    return Response.json({ acceptedReplyId: null });
  } catch (error) { return forumError(error); }
}
