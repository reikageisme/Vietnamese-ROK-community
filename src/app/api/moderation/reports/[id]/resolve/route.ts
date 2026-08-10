import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-guards";
import { forumError } from "@/modules/forum/http";
import { resolveReportSchema } from "@/modules/forum/schemas";
import { reportReputationLog } from "@/modules/forum/logic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(); requireRole(session, ["MODERATOR", "ADMIN"]); const { id } = await context.params; const input = resolveReportSchema.parse(await request.json());
    const report = await prisma.forumReport.findUnique({ where: { id }, include: { topic: { select: { authorId: true, id: true } }, reply: { select: { authorId: true, id: true, topicId: true } } } });
    if (!report) return Response.json({ error: "Không tìm thấy báo cáo." }, { status: 404 });
    const targetAuthorId = report.topic?.authorId ?? report.reply?.authorId;
    const targetType = report.topicId ? "TOPIC" : "REPLY"; const targetId = report.topicId ?? report.replyId!;
    const reputationLog = targetAuthorId ? reportReputationLog(report.status, input.status, targetAuthorId, id) : null;
    await prisma.$transaction(async (tx) => {
      await tx.forumReport.update({ where: { id }, data: { status: input.status, reviewedById: session.user.id, reviewedAt: new Date(), actionTaken: input.actionTaken } });
      if (reputationLog) await tx.reputationEvent.create({ data: reputationLog });
      await tx.forumNotification.create({ data: { userId: report.reporterId, actorId: session.user.id, type: "REPORT_RESOLVED", topicId: report.topicId ?? report.reply?.topicId, replyId: report.replyId } });
      if (input.status === "ACTION_TAKEN" && targetAuthorId && targetAuthorId !== report.reporterId) await tx.forumNotification.create({ data: { userId: targetAuthorId, actorId: session.user.id, type: "MODERATION_ACTION", topicId: report.topicId ?? report.reply?.topicId, replyId: report.replyId } });
      await tx.forumModerationAuditLog.create({ data: { moderatorId: session.user.id, action: `RESOLVE_REPORT_${input.status}`, targetType, targetId, metadata: { reportId: id, actionTaken: input.actionTaken ?? null, previousStatus: report.status } } });
    });
    return Response.json({ report: { id, status: input.status } });
  } catch (error) { return forumError(error); }
}
