import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { IngestionStatus, MetricSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authorizeCollector } from "@/modules/collector/auth";
import { collectorBatchSchema } from "@/modules/collector/schemas";

export const runtime = "nodejs";

function add(total: bigint, value: bigint) { return total + value; }

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.APP_SURFACE !== "ops") return new Response(null, { status: 404 });
  const authorization = authorizeCollector(request);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });

  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "JSON không hợp lệ." }, { status: 400 }); }
  const parsed = collectorBatchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Payload scan không hợp lệ.", details: parsed.error.flatten() }, { status: 422 });

  const input = parsed.data;
  const existing = await prisma.collectorBatch.findUnique({ where: { externalId: input.externalId }, select: { id: true, status: true } });
  if (existing) return NextResponse.json({ batchId: existing.id, status: existing.status, duplicate: true });

  const payloadHash = createHash("sha256").update(JSON.stringify(raw)).digest("hex");
  try {
    const result = await prisma.$transaction(async (tx) => {
      // GIU NGUYEN email "scanner@system.rokviet". Do la KHOA dinh danh, khong
      // phai thuong hieu: moi CollectorBatch va GovernorProfile da luu deu tro
      // ve user nay. Doi email = tao them mot user thu hai, du lieu cu mo coi.
      const systemUser = await tx.user.upsert({
        where: { email: "scanner@system.rokviet" },
        update: { isActive: false },
        create: { email: "scanner@system.rokviet", name: "ROK FAQ Collector", displayName: "ROK FAQ Collector", emailVerified: new Date(), isActive: false, loginMethods: [] },
      });
      const kingdom = await tx.kingdom.upsert({ where: { number: input.kingdom.number }, update: { name: input.kingdom.name }, create: { number: input.kingdom.number, name: input.kingdom.name } });
      const batch = await tx.collectorBatch.create({ data: { externalId: input.externalId, deviceId: input.deviceId, kingdomId: kingdom.id, recordCount: input.records.length, evidenceObjectKeys: input.evidenceObjectKeys, payloadHash, capturedAt: new Date(input.capturedAt), status: IngestionStatus.PENDING_REVIEW } });

      const allianceIds = new Map<string, string>();
      let power = BigInt(0); let killPoints = BigInt(0); let deadTroops = BigInt(0); let t4Kills = BigInt(0); let t5Kills = BigInt(0);
      for (const record of input.records) {
        let allianceId: string | undefined;
        if (record.allianceTag) {
          allianceId = allianceIds.get(record.allianceTag);
          if (!allianceId) {
            const alliance = await tx.alliance.upsert({ where: { kingdomId_tag: { kingdomId: kingdom.id, tag: record.allianceTag } }, update: { name: record.allianceName }, create: { kingdomId: kingdom.id, tag: record.allianceTag, name: record.allianceName } });
            allianceId = alliance.id; allianceIds.set(record.allianceTag, alliance.id);
          }
        }
        const profile = await tx.governorProfile.upsert({
          where: { governorId: record.governorId },
          update: { governorName: record.name, kingdomId: kingdom.id, allianceId },
          create: { ownerId: systemUser.id, governorId: record.governorId, governorName: record.name, kingdomId: kingdom.id, allianceId },
        });
        await tx.governorSnapshot.create({ data: { governorProfileId: profile.id, power: record.power, killPoints: record.killPoints, deadTroops: record.deadTroops, t1Kills: record.t1Kills, t2Kills: record.t2Kills, t3Kills: record.t3Kills, t4Kills: record.t4Kills, t5Kills: record.t5Kills, rangedPoints: record.rangedPoints, resourcesGathered: record.resourcesGathered, helps: record.helps, source: MetricSource.SCREENSHOT_OCR, capturedAt: new Date(input.capturedAt), collectorBatchId: batch.id } });
        power = add(power, record.power); killPoints = add(killPoints, record.killPoints); deadTroops = add(deadTroops, record.deadTroops); t4Kills = add(t4Kills, record.t4Kills); t5Kills = add(t5Kills, record.t5Kills);
      }
      const summary = { power: power.toString(), killPoints: killPoints.toString(), deadTroops: deadTroops.toString(), t4Kills: t4Kills.toString(), t5Kills: t5Kills.toString() };
      await tx.kingdomSnapshot.create({ data: { kingdomId: kingdom.id, collectorBatchId: batch.id, power, killPoints, deadTroops, t4Kills, t5Kills, governorCount: input.records.length, coveragePercent: input.coveragePercent, capturedAt: new Date(input.capturedAt) } });
      await tx.collectorBatch.update({ where: { id: batch.id }, data: { summary } });
      return { batchId: batch.id, recordCount: input.records.length, summary };
    }, { timeout: 60_000 });
    return NextResponse.json({ ...result, status: "PENDING_REVIEW", duplicate: false }, { status: 202 });
  } catch (error) {
    console.error("collector ingestion failed", error);
    return NextResponse.json({ error: "Không thể lưu batch scan." }, { status: 500 });
  }
}
