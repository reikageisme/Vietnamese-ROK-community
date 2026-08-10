import { prisma } from "@/lib/prisma";
import { identityError, IdentityError } from "@/modules/identity/http";
import { verifyEmailSchema } from "@/modules/identity/schemas";
import { hashOpaqueToken } from "@/modules/identity/tokens";

export async function POST(request: Request) {
  try {
    const { token } = verifyEmailSchema.parse(await request.json());
    const tokenHash = hashOpaqueToken(token);
    const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (record?.usedAt) {
      const user = await prisma.user.findUnique({ where: { id: record.userId }, select: { emailVerified: true } });
      if (user?.emailVerified) return Response.json({ ok: true, alreadyVerified: true });
    }
    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw new IdentityError("Liên kết xác thực không hợp lệ hoặc đã hết hạn.", 400, "INVALID_TOKEN");
    }
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.emailVerificationToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) throw new IdentityError("Liên kết đã được sử dụng.", 400, "INVALID_TOKEN");
      await tx.user.update({ where: { id: record.userId }, data: { emailVerified: new Date() } });
    });
    return Response.json({ ok: true });
  } catch (error) {
    return identityError(error);
  }
}
