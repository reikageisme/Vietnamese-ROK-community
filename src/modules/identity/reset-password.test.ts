import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findToken: vi.fn(), transaction: vi.fn(), hash: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { passwordResetToken: { findUnique: mocks.findToken }, $transaction: mocks.transaction } }));
vi.mock("@/modules/identity/password", () => ({ hashPassword: mocks.hash }));

import { POST } from "@/app/api/auth/reset-password/route";

describe("reset password", () => {
  beforeEach(() => {
    mocks.findToken.mockReset().mockResolvedValue({ id: "token-1", userId: "user-1", usedAt: null, expiresAt: new Date(Date.now() + 60_000) });
    mocks.hash.mockReset().mockResolvedValue("$argon2id$new");
  });

  it("claims the token and invalidates every old session", async () => {
    const tx = {
      passwordResetToken: { updateMany: vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }) },
      user: { update: vi.fn() }, account: { findFirst: vi.fn().mockResolvedValue(null) }, session: { deleteMany: vi.fn() },
    };
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<void>) => callback(tx));
    const response = await POST(new Request("http://localhost/api/auth/reset-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: "a".repeat(43), password: "newpassword123" }) }));
    expect(response.status).toBe(200);
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sessionVersion: { increment: 1 } }) }));
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });
});

