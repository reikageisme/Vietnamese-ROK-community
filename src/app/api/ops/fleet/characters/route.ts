import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { createCharacterSchema } from "@/modules/fleet-control/schemas";
import { isOpsSurface } from "@/modules/scan-service/catalog";

export async function POST(request: Request) {
  if (!isOpsSurface()) return new Response(null, { status: 404 });
  try { requireRole(await auth(), ["ADMIN"]); } catch { return new Response(null, { status: 403 }); }
  const parsed = createCharacterSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Cấu hình character không hợp lệ.", details: parsed.error.flatten() }, { status: 422 });
  const { serial, ...input } = parsed.data;
  const device = await prisma.collectorDevice.findUnique({ where: { serial } });
  if (!device) return NextResponse.json({ error: "Chưa thấy serial này heartbeat về server." }, { status: 404 });
  const character = await prisma.gameCharacter.upsert({
    where: { deviceId_key: { deviceId: device.id, key: input.key } },
    create: { deviceId: device.id, ...input, status: "VERIFYING" },
    update: { ...input, status: "VERIFYING", lastError: null },
  });
  return NextResponse.json({ character }, { status: 201 });
}
