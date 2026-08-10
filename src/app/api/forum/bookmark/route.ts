import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guards";
import { forumError } from "@/modules/forum/http";
import { topicIdSchema } from "@/modules/forum/schemas";

export async function POST(request: Request) {
  try {
    const session = await requireAuth(); const { topicId } = topicIdSchema.parse(await request.json());
    const topic = await prisma.topic.findFirst({ where: { id: topicId, deletedAt: null }, select: { id: true } });
    if (!topic) return Response.json({ error: "Không tìm thấy chủ đề." }, { status: 404 });
    await prisma.forumBookmark.upsert({ where: { userId_topicId: { userId: session.user.id, topicId } }, create: { userId: session.user.id, topicId }, update: {} });
    return Response.json({ bookmarked: true });
  } catch (error) { return forumError(error); }
}
