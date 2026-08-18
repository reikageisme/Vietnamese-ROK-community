import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeDeviceAgent, isDeviceAgentSurface } from "@/modules/fleet-control/auth";
import { heartbeatSchema } from "@/modules/fleet-control/schemas";
import { jsonValue } from "@/modules/fleet-control/scheduler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isDeviceAgentSurface()) return new Response(null, { status: 404 });
  const authorization = authorizeDeviceAgent(request);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  const parsed = heartbeatSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Heartbeat không hợp lệ.", details: parsed.error.flatten() }, { status: 422 });
  const input = parsed.data;
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.deviceAgent.upsert({
      where: { id: input.agentId },
      create: { id: input.agentId, name: input.name, hostname: input.hostname, version: input.version, status: input.error ? "DEGRADED" : "ONLINE", capabilities: jsonValue(input.capabilities), lastHeartbeatAt: now, lastError: input.error },
      update: { name: input.name, hostname: input.hostname, version: input.version, status: input.error ? "DEGRADED" : "ONLINE", capabilities: jsonValue(input.capabilities), lastHeartbeatAt: now, lastError: input.error },
    });
    for (const device of input.devices) {
      const savedDevice = await tx.collectorDevice.upsert({
        where: { serial: device.serial },
        create: { serial: device.serial, alias: device.alias, agentId: input.agentId, model: device.model, adbState: device.adbState, resolution: device.resolution, batteryPercent: device.batteryPercent, status: device.status, currentCharacterKey: device.currentCharacterKey, lastHeartbeatAt: now, lastError: device.error },
        update: { alias: device.alias, agentId: input.agentId, model: device.model, adbState: device.adbState, resolution: device.resolution, batteryPercent: device.batteryPercent, status: device.status, currentCharacterKey: device.currentCharacterKey ?? undefined, lastHeartbeatAt: now, lastError: device.error },
      });
      if (device.currentCharacterKey) {
        await tx.gameCharacter.updateMany({
          where: { deviceId: savedDevice.id, key: device.currentCharacterKey },
          data: { status: "READY", lastVerifiedAt: now, lastError: null },
        });
      }
    }
  });
  return NextResponse.json({ ok: true, serverTime: now.toISOString(), heartbeatAfterSeconds: 15 });
}
