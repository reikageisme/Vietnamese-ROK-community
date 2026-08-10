import { requireAuth } from "@/lib/auth-guards";
import { identityError, IdentityError } from "@/modules/identity/http";
import { createSecurityAction } from "@/modules/identity/security-actions";

export async function POST() {
  try {
    const session = await requireAuth();
    if (session.user.loginMethods.includes("google")) {
      throw new IdentityError("Tài khoản Google đã được liên kết.", 409, "ALREADY_LINKED");
    }
    await createSecurityAction(session.user.id, "LINK_GOOGLE");
    return Response.json({ ok: true, provider: "google" });
  } catch (error) {
    return identityError(error);
  }
}

