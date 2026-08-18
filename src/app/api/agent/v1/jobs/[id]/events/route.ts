import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeDeviceAgent, isDeviceAgentSurface } from "@/modules/fleet-control/auth";
import { jobEventSchema, rankingDocumentSchema } from "@/modules/fleet-control/schemas";
import { jsonValue } from "@/modules/fleet-control/scheduler";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isDeviceAgentSurface()) return new Response(null, { status: 404 });
  const authorization = authorizeDeviceAgent(request);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  const parsed = jobEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Sự kiện job không hợp lệ.", details: parsed.error.flatten() }, { status: 422 });
  const { id } = await context.params;
  const input = parsed.data;
  const current = await prisma.automationJob.findFirst({
    where: { id, leaseOwner: input.agentId, assignedDevice: { serial: input.serial, agentId: input.agentId } },
    include: { assignedDevice: true },
  });
  if (!current) return NextResponse.json({ error: "Job lease không tồn tại hoặc không thuộc agent." }, { status: 409 });
  const terminal = input.status === "COMPLETED" || input.status === "FAILED";
  const isRankingJob = current.type === "RANKING_SEED" || current.type === "RANKING_ALLIANCE" || current.type === "RANKING_HONOR";
  const ranking = isRankingJob && input.status === "COMPLETED"
    ? rankingDocumentSchema.safeParse(input.result?.ranking)
    : null;
  if (ranking && !ranking.success) {
    return NextResponse.json({ error: "Kết quả ranking không hợp lệ.", details: ranking.error.flatten() }, { status: 422 });
  }
  const leaseExpiresAt = terminal ? null : new Date(Date.now() + 15 * 60_000);
  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.automationJob.update({
      where: { id },
      data: { status: input.status, progress: jsonValue(input.progress), result: jsonValue(input.result), error: input.error, leaseExpiresAt, finishedAt: terminal ? new Date() : null },
    });
    if (ranking?.success) {
      const expectedType = ({ RANKING_SEED: "seed", RANKING_ALLIANCE: "alliance", RANKING_HONOR: "honor" } as const)[current.type as "RANKING_SEED" | "RANKING_ALLIANCE" | "RANKING_HONOR"];
      if (ranking.data.rankingType !== expectedType) throw new Error("Loại ranking trả về không khớp với job.");
      const batch = await tx.rankingScanBatch.upsert({
        where: { jobId: id },
        create: {
          jobId: id,
          kingdomNumber: current.kingdomNumber,
          rankingType: current.type,
          target: ranking.data.target,
          recordCount: ranking.data.records.length,
          capturedAt: new Date(ranking.data.capturedAt),
        },
        update: {
          target: ranking.data.target,
          recordCount: ranking.data.records.length,
          capturedAt: new Date(ranking.data.capturedAt),
        },
      });
      await tx.rankingScanEntry.deleteMany({ where: { batchId: batch.id } });
      if (ranking.data.records.length) {
        await tx.rankingScanEntry.createMany({
          data: ranking.data.records.map((row) => ({
            batchId: batch.id,
            rank: row.rank,
            name: row.name || null,
            score: row.score === null ? null : BigInt(row.score),
            needsReview: row.needsReview,
          })),
        });
      }
    }
    await tx.collectorDevice.update({
      where: { id: current.assignedDeviceId! },
      data: { status: terminal ? (input.status === "COMPLETED" ? "READY" : "ERROR") : "BUSY", currentCharacterKey: current.characterId ? (await tx.gameCharacter.findUnique({ where: { id: current.characterId }, select: { key: true } }))?.key : undefined, lastError: input.error },
    });
    if (current.serviceRequestId) {
      await tx.scanServiceRequest.update({
        where: { id: current.serviceRequestId },
        data: input.status === "COMPLETED" ? { status: "REVIEWING", collectorBatchId: input.collectorBatchId } : input.status === "FAILED" ? { status: "ASSIGNED" } : {},
      });
    }
    return job;
  });
  return NextResponse.json({ ok: true, status: result.status, leaseExpiresAt: result.leaseExpiresAt?.toISOString() });
}
