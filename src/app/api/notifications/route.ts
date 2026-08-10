import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guards";
import { forumError } from "@/modules/forum/http";

export async function GET(request: Request) {
  try {
    const session = await requireAuth(); const unreadOnly = new URL(request.url).searchParams.get("unreadOnly") === "true";
    const [unreadCount, notifications] = await prisma.$transaction([
      prisma.forumNotification.count({ where: { userId: session.user.id, isRead: false } }),
      prisma.forumNotification.findMany({ where: { userId: session.user.id, ...(unreadOnly ? { isRead: false } : {}) }, orderBy: { createdAt: "desc" }, take: 30, include: { actor: { select: { displayName: true, name: true } }, topic: { select: { slug: true, title: true } } } }),
    ]);
    return Response.json({ unreadCount, notifications });
  } catch (error) { return forumError(error); }
}
