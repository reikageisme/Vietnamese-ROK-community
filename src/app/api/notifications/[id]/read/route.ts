import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guards";
import { forumError } from "@/modules/forum/http";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const session = await requireAuth(); const { id } = await context.params; const result = await prisma.forumNotification.updateMany({ where: { id, userId: session.user.id }, data: { isRead: true } }); if (!result.count) return Response.json({ error: "Không tìm thấy thông báo." }, { status: 404 }); return Response.json({ read: true }); }
  catch (error) { return forumError(error); }
}
