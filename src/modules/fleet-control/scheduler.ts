import type { AutomationJobStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ACTIVE_STATUSES: AutomationJobStatus[] = ["LEASED", "SWITCHING", "SCANNING", "UPLOADING"];

export async function releaseExpiredLeases() {
  const now = new Date();
  const expired = await prisma.automationJob.findMany({
    where: { status: { in: ACTIVE_STATUSES }, leaseExpiresAt: { lt: now } },
    select: { id: true, attempts: true, maxAttempts: true },
    take: 100,
  });
  await Promise.all(expired.map((job) => prisma.automationJob.update({
    where: { id: job.id },
    data: job.attempts >= job.maxAttempts ? {
      status: "FAILED", finishedAt: now, error: "Agent lease hết hạn quá số lần thử.", leaseOwner: null, leaseExpiresAt: null,
    } : {
      status: "QUEUED", error: "Agent lease hết hạn; đã đưa lại vào hàng đợi.", leaseOwner: null, leaseExpiresAt: null, assignedDeviceId: null, characterId: null,
    },
  })));
  return expired.length;
}

export async function claimNextJob(agentId: string, serial: string) {
  await releaseExpiredLeases();
  const device = await prisma.collectorDevice.findFirst({
    where: { serial, agentId, status: { notIn: ["DISABLED", "ERROR"] } },
    include: { characters: { where: { status: { in: ["READY", "VERIFYING"] } }, orderBy: { switchOrder: "asc" } } },
  });
  if (!device) return null;
  const candidates = await prisma.automationJob.findMany({
    where: {
      status: "QUEUED",
      scheduledAt: { lte: new Date() },
      OR: [{ assignedDeviceId: null }, { assignedDeviceId: device.id }],
    },
    orderBy: [{ priority: "desc" }, { scheduledAt: "asc" }, { createdAt: "asc" }],
    take: 50,
  });
  for (const job of candidates) {
    if (job.attempts >= job.maxAttempts) continue;
    const characters = device.characters.filter((item) => item.kingdomNumber === job.kingdomNumber);
    const character = characters.find((item) => item.key === device.currentCharacterKey) ?? characters[0];
    if (!character) continue;
    const leaseExpiresAt = new Date(Date.now() + 15 * 60_000);
    const claimed = await prisma.automationJob.updateMany({
      where: { id: job.id, status: "QUEUED" },
      data: {
        status: "LEASED", assignedDeviceId: device.id, characterId: character.id,
        leaseOwner: agentId, leaseExpiresAt, attempts: { increment: 1 }, startedAt: job.startedAt ?? new Date(),
      },
    });
    if (!claimed.count) continue;
    await prisma.collectorDevice.update({ where: { id: device.id }, data: { status: "BUSY" } });
    return prisma.automationJob.findUnique({ where: { id: job.id }, include: { character: true, assignedDevice: true } });
  }
  return null;
}

export async function queueDuePolicies(limit = 250) {
  const now = new Date();
  const policies = await prisma.kingdomScanPolicy.findMany({
    where: { enabled: true, nextScanAt: { lte: now } },
    orderBy: [{ priority: "desc" }, { nextScanAt: "asc" }],
    take: limit,
  });
  let queued = 0;
  const coveredKingdoms = new Set((await prisma.gameCharacter.findMany({
    where: { status: { in: ["READY", "VERIFYING"] } },
    distinct: ["kingdomNumber"],
    select: { kingdomNumber: true },
  })).map((item) => item.kingdomNumber));
  for (const policy of policies) {
    if (!coveredKingdoms.has(policy.kingdomNumber)) {
      await prisma.kingdomScanPolicy.update({
        where: { id: policy.id },
        data: { nextScanAt: new Date(now.getTime() + 24 * 60 * 60_000) },
      });
      continue;
    }
    const existing = await prisma.automationJob.findFirst({
      where: { kingdomNumber: policy.kingdomNumber, status: { in: ["QUEUED", ...ACTIVE_STATUSES] } },
      select: { id: true },
    });
    const nextScanAt = new Date(now.getTime() + policy.cadenceMinutes * 60_000);
    let created = 0;
    if (!existing) {
      const insertion = await prisma.automationJob.createMany({
        data: [{
          type: policy.fullScan ? "KINGDOM_FULL" : "RANKING_SEED",
          kingdomNumber: policy.kingdomNumber,
          amount: policy.amount,
          priority: policy.activeKvk ? Math.max(policy.priority, 1_000) : policy.priority,
          scanName: `${policy.activeKvk ? "kvk" : "scheduled"}-kd${policy.kingdomNumber}`,
          scheduleKey: `${policy.id}:${policy.nextScanAt.toISOString()}`,
        }],
        skipDuplicates: true,
      });
      created = insertion.count;
      queued += created;
    }
    await prisma.kingdomScanPolicy.update({ where: { id: policy.id }, data: { nextScanAt, lastQueuedAt: created ? now : policy.lastQueuedAt } });
  }
  return { policies: policies.length, queued };
}

export function jsonValue(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  return value as Prisma.InputJsonValue | undefined;
}
