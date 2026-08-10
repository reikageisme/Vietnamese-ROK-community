import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-guards";
import { forumError } from "@/modules/forum/http";

export async function GET() {
  try {
    const session = await requireAuth(); requireRole(session, ["ADMIN"]);
    const entries = await prisma.forumModerationAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { moderator: { select: { id: true, displayName: true, name: true } } } });
    return Response.json({ entries });
  } catch (error) { return forumError(error); }
}
