import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guards";
import { forumError } from "@/modules/forum/http";
import { voteSchema } from "@/modules/forum/schemas";
import { voteTransition } from "@/modules/forum/logic";

export async function POST(request: Request) {
  try {
    const session = await requireAuth(); const input = voteSchema.parse(await request.json()); const value = input.value === "UP" ? 1 : -1;
    const result = await prisma.$transaction(async (tx) => {
      if (input.targetType === "TOPIC") {
        const target = await tx.topic.findFirst({ where: { id: input.targetId, deletedAt: null }, select: { id: true, authorId: true } });
        if (!target) return null;
        const key = { topicId_userId: { topicId: target.id, userId: session.user.id } };
        const previous = await tx.topicVote.findUnique({ where: key, select: { value: true } });
        const delta = voteTransition(previous?.value ?? null, value);
        await tx.topicVote.upsert({ where: key, create: { topicId: target.id, userId: session.user.id, value }, update: { value } });
        const updated = await tx.topic.update({ where: { id: target.id }, data: { upvoteCount: { increment: delta.upDelta }, downvoteCount: { increment: delta.downDelta } }, select: { upvoteCount: true, downvoteCount: true } });
        if (delta.reputationDelta && target.authorId !== session.user.id) await tx.reputationEvent.create({ data: { userId: target.authorId, reason: delta.reputationDelta > 0 ? "TOPIC_UPVOTED" : "TOPIC_DOWNVOTED", points: delta.reputationDelta, sourceRef: `topic:${target.id}:vote:${session.user.id}` } });
        return { active: true, value, score: updated.upvoteCount - updated.downvoteCount };
      }
      const target = await tx.reply.findFirst({ where: { id: input.targetId, deletedAt: null }, select: { id: true, authorId: true } });
      if (!target) return null;
      const key = { replyId_userId: { replyId: target.id, userId: session.user.id } };
      const previous = await tx.replyVote.findUnique({ where: key, select: { value: true } });
      const delta = voteTransition(previous?.value ?? null, value);
      await tx.replyVote.upsert({ where: key, create: { replyId: target.id, userId: session.user.id, value }, update: { value } });
      const updated = await tx.reply.update({ where: { id: target.id }, data: { upvoteCount: { increment: delta.upDelta }, downvoteCount: { increment: delta.downDelta } }, select: { upvoteCount: true, downvoteCount: true } });
      if (delta.reputationDelta && target.authorId !== session.user.id) await tx.reputationEvent.create({ data: { userId: target.authorId, reason: delta.reputationDelta > 0 ? "REPLY_UPVOTED" : "REPLY_DOWNVOTED", points: delta.reputationDelta, sourceRef: `reply:${target.id}:vote:${session.user.id}` } });
      return { active: true, value, score: updated.upvoteCount - updated.downvoteCount };
    });
    if (!result) return Response.json({ error: "Không tìm thấy nội dung." }, { status: 404 });
    return Response.json(result);
  } catch (error) { return forumError(error); }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth();
    const input = voteSchema.omit({ value: true }).parse(await request.json());
    const result = await prisma.$transaction(async (tx) => {
      if (input.targetType === "TOPIC") {
        const key = { topicId_userId: { topicId: input.targetId, userId: session.user.id } };
        const previous = await tx.topicVote.findUnique({ where: key, include: { topic: { select: { authorId: true } } } });
        if (!previous) return { active: false };
        const delta = voteTransition(previous.value, null);
        await tx.topicVote.delete({ where: key });
        const updated = await tx.topic.update({ where: { id: input.targetId }, data: { upvoteCount: { increment: delta.upDelta }, downvoteCount: { increment: delta.downDelta } }, select: { upvoteCount: true, downvoteCount: true } });
        if (delta.reputationDelta && previous.topic.authorId !== session.user.id) await tx.reputationEvent.create({ data: { userId: previous.topic.authorId, reason: delta.reputationDelta > 0 ? "TOPIC_UPVOTED" : "TOPIC_DOWNVOTED", points: delta.reputationDelta, sourceRef: `topic:${input.targetId}:vote-removed:${session.user.id}` } });
        return { active: false, score: updated.upvoteCount - updated.downvoteCount };
      }
      const key = { replyId_userId: { replyId: input.targetId, userId: session.user.id } };
      const previous = await tx.replyVote.findUnique({ where: key, include: { reply: { select: { authorId: true } } } });
      if (!previous) return { active: false };
      const delta = voteTransition(previous.value, null);
      await tx.replyVote.delete({ where: key });
      const updated = await tx.reply.update({ where: { id: input.targetId }, data: { upvoteCount: { increment: delta.upDelta }, downvoteCount: { increment: delta.downDelta } }, select: { upvoteCount: true, downvoteCount: true } });
      if (delta.reputationDelta && previous.reply.authorId !== session.user.id) await tx.reputationEvent.create({ data: { userId: previous.reply.authorId, reason: delta.reputationDelta > 0 ? "REPLY_UPVOTED" : "REPLY_DOWNVOTED", points: delta.reputationDelta, sourceRef: `reply:${input.targetId}:vote-removed:${session.user.id}` } });
      return { active: false, score: updated.upvoteCount - updated.downvoteCount };
    });
    return Response.json(result);
  } catch (error) { return forumError(error); }
}
