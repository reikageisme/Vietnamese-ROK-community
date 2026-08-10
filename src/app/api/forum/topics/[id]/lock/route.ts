import { prisma } from "@/lib/prisma";
import { requireAuth, AuthorizationError } from "@/lib/auth-guards";
import { forumError } from "@/modules/forum/http";
import { isForumModerator } from "@/modules/forum/permissions";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(); if (!isForumModerator(session.user.role)) throw new AuthorizationError("Chỉ moderator được khóa chủ đề.");
    const { id } = await context.params; const body = await request.json().catch(() => ({})) as { locked?: boolean };
    const topic = await prisma.topic.update({ where: { id }, data: { isLocked: body.locked ?? true } });
    await prisma.forumModerationAuditLog.create({ data: { moderatorId: session.user.id, action: topic.isLocked ? "LOCK_TOPIC" : "UNLOCK_TOPIC", targetType: "TOPIC", targetId: id } });
    return Response.json({ isLocked: topic.isLocked });
  } catch (error) { return forumError(error); }
}
