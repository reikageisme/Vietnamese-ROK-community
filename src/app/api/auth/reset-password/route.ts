import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/modules/identity/password";
import { identityError, IdentityError } from "@/modules/identity/http";
import { resetPasswordSchema } from "@/modules/identity/schemas";
import { hashOpaqueToken } from "@/modules/identity/tokens";

export async function POST(request: Request) {
  try {
    const input = resetPasswordSchema.parse(await request.json());
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashOpaqueToken(input.token) } });
    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw new IdentityError("Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.", 400, "INVALID_TOKEN");
    }
    const passwordHash = await hashPassword(input.password);
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) throw new IdentityError("Liên kết đã được sử dụng.", 400, "INVALID_TOKEN");
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash, sessionVersion: { increment: 1 }, loginMethods: { set: ["credentials"] } },
      });
      const google = await tx.account.findFirst({ where: { userId: record.userId, provider: "google" }, select: { id: true } });
      if (google) await tx.user.update({ where: { id: record.userId }, data: { loginMethods: { set: ["google", "credentials"] } } });
      await tx.session.deleteMany({ where: { userId: record.userId } });
      await tx.passwordResetToken.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: new Date() } });
    });
    return Response.json({ ok: true, signInRequired: true });
  } catch (error) {
    return identityError(error);
  }
}

