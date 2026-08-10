import { NextResponse } from "next/server";
import { z } from "zod";

import { calculateSpeedup } from "@/modules/tools/calculators";

const durationSchema = z.object({
  days: z.number().nonnegative().optional(),
  hours: z.number().nonnegative().optional(),
  minutes: z.number().nonnegative().optional(),
  seconds: z.number().nonnegative().optional(),
});

const inputSchema = z.object({
  target: durationSchema,
  available: durationSchema,
});

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_INPUT" } }, { status: 400 });
  }

  return NextResponse.json({ data: calculateSpeedup(parsed.data) });
}
