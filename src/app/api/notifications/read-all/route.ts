import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guards";
import { forumError } from "@/modules/forum/http";

export async function POST() {
  try { const session = await requireAuth(); await prisma.forumNotification.updateMany({ where: { userId: session.user.id, isRead: false }, data: { isRead: true } }); return Response.json({ read: true }); }
  catch (error) { return forumError(error); }
}
