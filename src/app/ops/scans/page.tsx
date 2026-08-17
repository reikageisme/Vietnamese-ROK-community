import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isOpsSurface } from "@/modules/scan-service/catalog";
import { OpsScanConsole } from "@/components/ops-scan-console";

export const metadata: Metadata = { title: "Ops Console" };

export default async function OpsScansPage() {
  if (!isOpsSurface()) notFound();
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/ops/scans");
  if (!["MODERATOR", "ADMIN"].includes(session.user.role)) notFound();
  const [topUps, requests, batches] = await Promise.all([
    prisma.topUpRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 100, include: { requester: { select: { email: true, displayName: true, name: true } } } }),
    prisma.scanServiceRequest.findMany({ where: { status: { notIn: ["COMPLETED", "REFUNDED"] } }, orderBy: { createdAt: "asc" }, take: 100, include: { requester: { select: { email: true, displayName: true, name: true } } } }),
    prisma.collectorBatch.findMany({ orderBy: { capturedAt: "desc" }, take: 50, include: { kingdom: { select: { number: true } } } }),
  ]);
  return <div className="data-page"><section className="data-hero ops-hero"><div className="shell"><span className="data-eyebrow"><i /> PRIVATE OPERATIONS</span><h1>RokViet <em>Ops Console</em></h1><p>Đối soát credit, điều phối đơn quét và kiểm tra batch collector.</p></div></section><OpsScanConsole initialTopUps={topUps.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), reviewedAt: item.reviewedAt?.toISOString() ?? null }))} initialRequests={requests.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), completedAt: item.completedAt?.toISOString() ?? null }))} initialBatches={batches.map((item) => ({ ...item, capturedAt: item.capturedAt.toISOString(), createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() }))} /></div>;
}
