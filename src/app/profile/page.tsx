import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ProfileDashboard } from "@/components/profile-dashboard";
import { prisma } from "@/lib/prisma";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/profile");
  const [user, reputation, bookmarks, subscriptions] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { id: true, displayName: true, name: true, email: true, locale: true, createdAt: true } }),
    prisma.reputationEvent.aggregate({ where: { userId: session.user.id }, _sum: { points: true } }),
    prisma.forumBookmark.findMany({ where: { userId: session.user.id, topic: { deletedAt: null } }, orderBy: { createdAt: "desc" }, take: 30, select: { topic: { select: { id: true, slug: true, title: true, updatedAt: true, category: { select: { slug: true } } } } } }),
    prisma.forumSubscription.findMany({ where: { userId: session.user.id, topic: { deletedAt: null } }, orderBy: { createdAt: "desc" }, take: 30, select: { topic: { select: { id: true, slug: true, title: true, updatedAt: true, category: { select: { slug: true } } } } } }),
  ]);
  return <div className="shell page"><div className="page-intro"><p className="eyebrow">TÀI KHOẢN</p><h1>Trang cá nhân</h1><p>Quản lý danh tính cộng đồng, bài đã lưu và các thảo luận đang theo dõi.</p></div><ProfileDashboard user={{ id: user.id, displayName: user.displayName ?? user.name ?? "Thành viên", email: user.email, locale: user.locale, role: session.user.role, reputation: reputation._sum.points ?? 0, joinedAt: user.createdAt.toISOString() }} bookmarks={bookmarks.map((item) => ({ ...item.topic, updatedAt: item.topic.updatedAt.toISOString() }))} subscriptions={subscriptions.map((item) => ({ ...item.topic, updatedAt: item.topic.updatedAt.toISOString() }))} /></div>;
}
