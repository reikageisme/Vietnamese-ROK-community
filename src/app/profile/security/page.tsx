import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SecurityPanel } from "@/components/security-panel";

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ reauth?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/profile/security");
  const [user, query] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { loginMethods: true, emailVerified: true } }),
    searchParams,
  ]);
  return <div className="shell page narrow-page"><div className="page-intro"><p className="eyebrow">TÀI KHOẢN</p><h1>Bảo mật đăng nhập</h1><p>Quản lý Google và mật khẩu. Tài khoản luôn phải giữ ít nhất một phương thức đăng nhập.</p></div><SecurityPanel initialMethods={user.loginMethods} emailVerified={Boolean(user.emailVerified)} reauthenticated={query.reauth === "1"} /></div>;
}

