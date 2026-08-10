import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ModerationReports } from "@/components/moderation-reports";
export default async function ReportsPage() { const session = await auth(); if (!session?.user) redirect("/auth/signin?callbackUrl=/moderation/reports"); if (!["MODERATOR", "ADMIN"].includes(session.user.role)) notFound(); return <div className="shell page narrow-page"><div className="page-intro"><p className="eyebrow">MODERATION</p><h1>Báo cáo cộng đồng</h1></div><ModerationReports /></div>; }
