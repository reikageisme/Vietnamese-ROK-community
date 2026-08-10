import { requireAuth } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { identityError, IdentityError } from "@/modules/identity/http";
import { z } from "zod";
import { removeLoginMethod } from "@/modules/identity/login-methods";

export async function GET() {
  try {
    const session = await requireAuth();
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { email: true, emailVerified: true, loginMethods: true },
    });
    return Response.json({ ...user, emailVerified: Boolean(user.emailVerified) });
  } catch (error) {
    return identityError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth();
    const { method } = z.object({ method: z.enum(["google", "credentials"]) }).parse(await request.json());
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { loginMethods: true },
    });
    const removal = removeLoginMethod(user.loginMethods, method);
    if (!removal.ok && removal.code === "METHOD_NOT_FOUND") throw new IdentityError("Phương thức này chưa được liên kết.", 404, removal.code);
    if (!removal.ok) throw new IdentityError("Không thể gỡ phương thức đăng nhập cuối cùng.", 409, removal.code);
    const loginMethods = removal.methods;
    await prisma.$transaction(async (tx) => {
      if (method === "google") {
        await tx.account.deleteMany({ where: { userId: session.user.id, provider: "google" } });
        await tx.user.update({ where: { id: session.user.id }, data: { googleSub: null, loginMethods } });
      } else {
        await tx.user.update({ where: { id: session.user.id }, data: { passwordHash: null, loginMethods } });
      }
    });
    return Response.json({ ok: true, loginMethods });
  } catch (error) {
    return identityError(error);
  }
}
