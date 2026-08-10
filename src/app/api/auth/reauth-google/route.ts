import { requireAuth } from "@/lib/auth-guards";
import { identityError, IdentityError } from "@/modules/identity/http";
import { createSecurityAction } from "@/modules/identity/security-actions";

export async function POST() {
  try {
    const session = await requireAuth();
    if (!session.user.loginMethods.includes("google")) {
      throw new IdentityError("Tài khoản chưa liên kết Google.", 400, "GOOGLE_NOT_LINKED");
    }
    await createSecurityAction(session.user.id, "SET_PASSWORD");
    return Response.json({ ok: true, provider: "google" });
  } catch (error) {
    return identityError(error);
  }
}

