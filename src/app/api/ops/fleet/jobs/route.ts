import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { createAutomationJobSchema } from "@/modules/fleet-control/schemas";
import { isOpsSurface } from "@/modules/scan-service/catalog";

export async function POST(request: Request) {
  if (!isOpsSurface()) return new Response(null, { status: 404 });
  try { requireRole(await auth(), ["MODERATOR", "ADMIN"]); } catch { return new Response(null, { status: 403 }); }
  const parsed = createAutomationJobSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Job không hợp lệ.", details: parsed.error.flatten() }, { status: 422 });
  const { serial, scheduledAt, ...input } = parsed.data;
  const device = serial ? await prisma.collectorDevice.findUnique({ where: { serial } }) : null;
  if (serial && !device) return NextResponse.json({ error: "Không tìm thấy thiết bị." }, { status: 404 });
  const character = device ? await prisma.gameCharacter.findFirst({ where: { deviceId: device.id, kingdomNumber: input.kingdomNumber, status: { in: ["READY", "VERIFYING"] } }, orderBy: { switchOrder: "asc" } }) : null;
  if (device && !character) return NextResponse.json({ error: "Thiết bị chưa có character cho Kingdom này." }, { status: 409 });
  const job = await prisma.$transaction(async (tx) => {
    await tx.kingdom.upsert({ where: { number: input.kingdomNumber }, create: { number: input.kingdomNumber }, update: {} });
    return tx.automationJob.create({ data: { ...input, assignedDeviceId: device?.id, characterId: character?.id, scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date() } });
  });
  return NextResponse.json({ job }, { status: 201 });
}
