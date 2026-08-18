import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { scanPolicySchema } from "@/modules/fleet-control/schemas";
import { queueDuePolicies } from "@/modules/fleet-control/scheduler";
import { isOpsSurface } from "@/modules/scan-service/catalog";

export async function POST(request: Request) {
  if (!isOpsSurface()) return new Response(null, { status: 404 });
  try { requireRole(await auth(), ["ADMIN"]); } catch { return new Response(null, { status: 403 }); }
  const parsed = scanPolicySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Chính sách quét không hợp lệ.", details: parsed.error.flatten() }, { status: 422 });
  const policy = await prisma.kingdomScanPolicy.upsert({ where: { kingdomNumber: parsed.data.kingdomNumber }, create: parsed.data, update: parsed.data });
  return NextResponse.json({ policy }, { status: 201 });
}

export async function PUT() {
  if (!isOpsSurface()) return new Response(null, { status: 404 });
  try { requireRole(await auth(), ["ADMIN"]); } catch { return new Response(null, { status: 403 }); }
  return NextResponse.json(await queueDuePolicies());
}
