import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { isOpsSurface } from "@/modules/scan-service/catalog";

export async function GET() {
  if (!isOpsSurface()) return new Response(null, { status: 404 });
  try { requireRole(await auth(), ["MODERATOR", "ADMIN"]); } catch { return new Response(null, { status: 403 }); }
  const [agents, devices, jobs, policies] = await Promise.all([
    prisma.deviceAgent.findMany({ orderBy: { name: "asc" } }),
    prisma.collectorDevice.findMany({ orderBy: { alias: "asc" }, include: { characters: { orderBy: { switchOrder: "asc" } } } }),
    prisma.automationJob.findMany({ orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }], take: 200, include: { assignedDevice: { select: { alias: true, serial: true } }, character: { select: { label: true, key: true } } } }),
    prisma.kingdomScanPolicy.findMany({ orderBy: [{ activeKvk: "desc" }, { priority: "desc" }, { kingdomNumber: "asc" }], take: 500 }),
  ]);
  return NextResponse.json({ agents, devices, jobs, policies });
}
