import type { ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-guards";
import { forumError } from "@/modules/forum/http";
import { moderationReportQuerySchema } from "@/modules/forum/schemas";

const statusMap: Record<string, ReportStatus> = { pending: "PENDING", reviewed: "REVIEWED", dismissed: "DISMISSED", action_taken: "ACTION_TAKEN" };

export async function GET(request: Request) {
  try {
    const session = await requireAuth(); requireRole(session, ["MODERATOR", "ADMIN"]);
    const query = moderationReportQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const reports = await prisma.forumReport.findMany({
      where: { status: statusMap[query.status] }, orderBy: { createdAt: "asc" }, take: 100,
      include: { reporter: { select: { id: true, displayName: true, name: true } }, topic: { select: { id: true, slug: true, title: true, authorId: true } }, reply: { select: { id: true, body: true, authorId: true, topic: { select: { slug: true, title: true } } } } },
    });
    return Response.json({ reports });
  } catch (error) { return forumError(error); }
}
