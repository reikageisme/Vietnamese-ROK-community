import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guards";
import { forumError } from "@/modules/forum/http";

export async function DELETE(_request: Request, context: { params: Promise<{ topicId: string }> }) {
  try { const session = await requireAuth(); const { topicId } = await context.params; await prisma.forumBookmark.deleteMany({ where: { userId: session.user.id, topicId } }); return new Response(null, { status: 204 }); }
  catch (error) { return forumError(error); }
}
