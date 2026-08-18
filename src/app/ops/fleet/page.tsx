import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { FleetControl } from "@/components/fleet-control";
import { isOpsSurface } from "@/modules/scan-service/catalog";

export const metadata: Metadata = { title: "Fleet Control" };

export default async function OpsFleetPage() {
  if (!isOpsSurface()) notFound();
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/ops/fleet");
  if (!["MODERATOR", "ADMIN"].includes(session.user.role)) notFound();
  return <div className="data-page fleet-page">
    <section className="data-hero ops-hero"><div className="shell">
      <span className="data-eyebrow"><i /> PRIVATE FLEET CONTROL · PORT 3031</span>
      <h1>Box phone <em>Automation</em></h1>
      <p>Heartbeat, character theo Kingdom, lịch quét và tiến độ 2–18 điện thoại. Chỉ agent có token mới nhận được route đổi nhân vật.</p>
      <div className="ops-subnav"><Link className="active" href="/ops/fleet">Fleet</Link><Link href="/ops/scans">Đơn quét & credit</Link></div>
    </div></section>
    <FleetControl canConfigure={session.user.role === "ADMIN"} />
  </div>;
}
