import { prisma } from "@/lib/prisma";
import { requireAuth, AuthorizationError } from "@/lib/auth-guards";
import { forumError } from "@/modules/forum/http";
import { isForumModerator } from "@/modules/forum/permissions";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(); if (!isForumModerator(session.user.role)) throw new AuthorizationError("Chỉ moderator được ghim chủ đề.");
    const { id } = await context.params; const body = await request.json().catch(() => ({})) as { pinned?: boolean };
    const topic = await prisma.topic.update({ where: { id }, data: { isPinned: body.pinned ?? true } });
    await prisma.forumModerationAuditLog.create({ data: { moderatorId: session.user.id, action: topic.isPinned ? "PIN_TOPIC" : "UNPIN_TOPIC", targetType: "TOPIC", targetId: id } });
    return Response.json({ isPinned: topic.isPinned });
  } catch (error) { return forumError(error); }
}
