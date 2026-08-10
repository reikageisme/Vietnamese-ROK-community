import { prisma } from "@/lib/prisma";
import { requireVerifiedContributor } from "@/lib/auth-guards";
import { forumError } from "@/modules/forum/http";
import { reportSchema } from "@/modules/forum/schemas";

export async function POST(request: Request) {
  try {
    const session = await requireVerifiedContributor(); const input = reportSchema.parse(await request.json());
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const count = await prisma.forumReport.count({ where: { reporterId: session.user.id, createdAt: { gte: since } } });
    if (count >= 5) return Response.json({ error: "Bạn đã đạt giới hạn 5 báo cáo mỗi giờ." }, { status: 429 });
    const target = input.targetType === "TOPIC"
      ? await prisma.topic.findFirst({ where: { id: input.targetId, deletedAt: null }, select: { id: true } })
      : await prisma.reply.findFirst({ where: { id: input.targetId, deletedAt: null }, select: { id: true } });
    if (!target) return Response.json({ error: "Không tìm thấy nội dung." }, { status: 404 });
    const report = await prisma.forumReport.create({ data: { reporterId: session.user.id, topicId: input.targetType === "TOPIC" ? input.targetId : null, replyId: input.targetType === "REPLY" ? input.targetId : null, reason: input.reason, detail: input.note ?? input.detail } });
    return Response.json({ report: { id: report.id, status: report.status } }, { status: 201 });
  } catch (error) { return forumError(error); }
}
