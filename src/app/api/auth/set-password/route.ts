import { requireAuth } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { securityNoticeEmail } from "@/lib/email";
import { identityError, IdentityError } from "@/modules/identity/http";
import { hashPassword, verifyPassword } from "@/modules/identity/password";
import { setPasswordSchema } from "@/modules/identity/schemas";
import { clearSecurityActionCookie, currentSecurityAction } from "@/modules/identity/security-actions";
import { addLoginMethod } from "@/modules/identity/login-methods";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const input = setPasswordSchema.parse(await request.json());
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { passwordHash: true, loginMethods: true, email: true },
    });

    let actionId: string | null = null;
    if (user.passwordHash) {
      if (!input.currentPassword || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
        throw new IdentityError("Mật khẩu hiện tại không đúng.", 403, "REAUTH_REQUIRED");
      }
    } else {
      const action = await currentSecurityAction("SET_PASSWORD");
      if (!action || action.userId !== session.user.id || !action.verifiedAt) {
        throw new IdentityError("Vui lòng xác thực lại bằng Google trước khi thêm mật khẩu.", 403, "REAUTH_REQUIRED");
      }
      actionId = action.id;
    }

    const passwordHash = await hashPassword(input.password);
    const loginMethods = addLoginMethod(user.loginMethods, "credentials");
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: session.user.id }, data: { passwordHash, loginMethods } });
      if (actionId) await tx.securityActionToken.update({ where: { id: actionId }, data: { usedAt: new Date() } });
    });
    if (actionId) await clearSecurityActionCookie();
    if (user.email) await securityNoticeEmail(user.email, "Tài khoản của bạn vừa được thêm phương thức đăng nhập bằng mật khẩu");
    return Response.json({ ok: true, loginMethods });
  } catch (error) {
    return identityError(error);
  }
}
