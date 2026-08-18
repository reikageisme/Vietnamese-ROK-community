import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { isOpsSurface } from "@/modules/scan-service/catalog";

const schema = z.object({
  from: z.coerce.number().int().min(1000).max(9999),
  to: z.coerce.number().int().min(1000).max(9999),
  cadenceMinutes: z.coerce.number().int().min(1_440).max(525_600).default(43_200),
}).refine((value) => value.to >= value.from && value.to - value.from <= 4_000, "Khoảng Kingdom không hợp lệ.");

export async function POST(request: Request) {
  if (!isOpsSurface()) return new Response(null, { status: 404 });
  try { requireRole(await auth(), ["ADMIN"]); } catch { return new Response(null, { status: 403 }); }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Khoảng Kingdom không hợp lệ." }, { status: 422 });
  const numbers = Array.from({ length: parsed.data.to - parsed.data.from + 1 }, (_, index) => parsed.data.from + index);
  const result = await prisma.$transaction(async (tx) => {
    const kingdoms = await tx.kingdom.createMany({ data: numbers.map((number) => ({ number })), skipDuplicates: true });
    const policies = await tx.kingdomScanPolicy.createMany({
      data: numbers.map((kingdomNumber) => ({ kingdomNumber, cadenceMinutes: parsed.data.cadenceMinutes, priority: 10, amount: 300, fullScan: false, reason: "Dữ liệu nền; chỉ queue khi có character truy cập." })),
      skipDuplicates: true,
    });
    return { kingdomsCreated: kingdoms.count, policiesCreated: policies.count, totalRequested: numbers.length };
  });
  return NextResponse.json(result, { status: 201 });
}
