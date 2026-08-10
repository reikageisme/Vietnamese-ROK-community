import { prisma } from "@/lib/prisma";
import { passwordResetEmail } from "@/lib/email";
import { forgotPasswordSchema } from "@/modules/identity/schemas";
import { appUrl, createOpaqueToken } from "@/modules/identity/tokens";
import { identityError } from "@/modules/identity/http";

const safeMessage = "Nếu email tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.";

export async function POST(request: Request) {
  try {
    const startedAt = Date.now();
    const { email } = forgotPasswordSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, passwordHash: true } });
    if (user?.passwordHash && user.email) {
      const opaque = createOpaqueToken();
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: opaque.tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      });
      await passwordResetEmail(user.email, appUrl(`/auth/reset-password?token=${encodeURIComponent(opaque.token)}`));
    }
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, 750 - (Date.now() - startedAt))));
    return Response.json({ message: safeMessage });
  } catch (error) {
    return identityError(error);
  }
}
