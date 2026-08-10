import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ failures: 0, passwordHash: "$argon2id$hash" as string | null }));
const findUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique } } }));
vi.mock("@/modules/identity/rate-limit", () => ({
  isLoginLocked: vi.fn(async () => state.failures >= 5),
  recordFailedLogin: vi.fn(async () => ++state.failures),
  clearFailedLogins: vi.fn(async () => { state.failures = 0; }),
}));
vi.mock("@/modules/identity/password", () => ({
  verifyPassword: vi.fn(async (_hash: string, password: string) => password === "correct-password-1"),
  verifyDummyPassword: vi.fn(async () => false),
}));

import { authorizeCredentials } from "./credentials";

describe("credentials authentication", () => {
  beforeEach(() => {
    state.failures = 0;
    state.passwordHash = "$argon2id$hash";
    findUnique.mockReset().mockImplementation(async () => ({ id: "user-1", name: "Rok", displayName: "Rok", email: "rok@example.com", image: null, passwordHash: state.passwordHash, isActive: true }));
  });

  it("returns the same persisted user when the password is valid", async () => {
    const user = await authorizeCredentials({ email: "ROK@example.com", password: "correct-password-1" });
    expect(user?.id).toBe("user-1");
  });

  it("locks the sixth attempt after five consecutive failures, even with the right password", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await authorizeCredentials({ email: "rok@example.com", password: "wrong-password-1" })).toBeNull();
    }
    expect(await authorizeCredentials({ email: "rok@example.com", password: "correct-password-1" })).toBeNull();
    expect(findUnique).toHaveBeenCalledTimes(5);
  });
});

