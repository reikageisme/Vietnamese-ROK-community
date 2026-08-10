import { prisma } from "@/lib/prisma";
import { verificationEmail } from "@/lib/email";
import { hashPassword } from "@/modules/identity/password";
import { consumeRegistrationAttempt } from "@/modules/identity/rate-limit";
import { registerSchema } from "@/modules/identity/schemas";
import { appUrl, createOpaqueToken } from "@/modules/identity/tokens";
import { IdentityError, identityError, requestIp } from "@/modules/identity/http";

export async function POST(request: Request) {
  try {
    const limit = await consumeRegistrationAttempt(requestIp(request));
    if (!limit.allowed) throw new IdentityError("Bạn đã đăng ký quá nhiều lần. Vui lòng thử lại sau một giờ.", 429, "RATE_LIMITED");
    const input = registerSchema.parse(await request.json());
    const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { googleSub: true, passwordHash: true } });
    if (existing?.googleSub && !existing.passwordHash) {
      throw new IdentityError(
        "Email này đã được dùng để đăng nhập qua Google. Hãy đăng nhập bằng Google rồi dùng chức năng Thêm mật khẩu.",
        409,
        "GOOGLE_EMAIL_EXISTS",
      );
    }
    if (existing) throw new IdentityError("Email đã được đăng ký.", 409, "EMAIL_REGISTERED");

    const [passwordHash, opaque] = await Promise.all([hashPassword(input.password), Promise.resolve(createOpaqueToken())]);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.displayName,
        displayName: input.displayName,
        passwordHash,
        loginMethods: ["credentials"],
        roles: { create: { role: "MEMBER" } },
        emailVerificationTokens: {
          create: { tokenHash: opaque.tokenHash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        },
      },
      select: { id: true, email: true, displayName: true },
    });
    await verificationEmail(user.email!, appUrl(`/auth/verify-email?token=${encodeURIComponent(opaque.token)}`));
    return Response.json({ user, verificationRequired: true }, { status: 201 });
  } catch (error) {
    return identityError(error);
  }
}

