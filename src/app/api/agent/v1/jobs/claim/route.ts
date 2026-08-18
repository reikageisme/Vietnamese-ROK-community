import { NextResponse } from "next/server";
import { authorizeDeviceAgent, isDeviceAgentSurface } from "@/modules/fleet-control/auth";
import { claimJobSchema } from "@/modules/fleet-control/schemas";
import { claimNextJob, queueDuePolicies } from "@/modules/fleet-control/scheduler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isDeviceAgentSurface()) return new Response(null, { status: 404 });
  const authorization = authorizeDeviceAgent(request);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  const parsed = claimJobSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Yêu cầu nhận job không hợp lệ." }, { status: 422 });
  await queueDuePolicies(50);
  const job = await claimNextJob(parsed.data.agentId, parsed.data.serial);
  if (!job) return new Response(null, { status: 204 });
  return NextResponse.json({
    job: {
      id: job.id,
      type: job.type,
      kingdomNumber: job.kingdomNumber,
      amount: job.amount,
      scanName: job.scanName,
      leaseExpiresAt: job.leaseExpiresAt?.toISOString(),
      character: job.character ? {
        key: job.character.key,
        label: job.character.label,
        kingdomNumber: job.character.kingdomNumber,
        governorId: job.character.governorId,
        switchRoute: job.character.switchRoute,
        scanRoutes: job.character.scanRoutes,
      } : null,
    },
  });
}
