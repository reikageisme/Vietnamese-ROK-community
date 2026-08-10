import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), create: vi.fn(), send: vi.fn(), hash: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mocks.findUnique, create: mocks.create } } }));
vi.mock("@/lib/email", () => ({ verificationEmail: mocks.send }));
vi.mock("@/modules/identity/password", () => ({ hashPassword: mocks.hash }));
vi.mock("@/modules/identity/rate-limit", () => ({ consumeRegistrationAttempt: vi.fn(async () => ({ allowed: true, remaining: 4 })) }));

import { POST } from "@/app/api/auth/register/route";

function request() {
  return new Request("http://localhost/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "rok@example.com", password: "password1234", displayName: "Governor", acceptedTerms: true }) });
}

describe("registration API", () => {
  beforeEach(() => {
    mocks.findUnique.mockReset().mockResolvedValue(null);
    mocks.create.mockReset().mockResolvedValue({ id: "user-1", email: "rok@example.com", displayName: "Governor" });
    mocks.hash.mockReset().mockResolvedValue("$argon2id$not-plaintext");
    mocks.send.mockReset().mockResolvedValue(undefined);
  });

  it("creates exactly one credentials user and never stores plaintext", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledOnce();
    const data = mocks.create.mock.calls[0][0].data;
    expect(data.passwordHash).toBe("$argon2id$not-plaintext");
    expect(data.passwordHash).not.toBe("password1234");
    expect(data.loginMethods).toEqual(["credentials"]);
    expect(data.roles.create.role).toBe("MEMBER");
  });

  it("does not merge silently with an existing Google-only user", async () => {
    mocks.findUnique.mockResolvedValue({ googleSub: "google-sub", passwordHash: null });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("GOOGLE_EMAIL_EXISTS");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects an existing credentials email without creating a duplicate", async () => {
    mocks.findUnique.mockResolvedValue({ googleSub: null, passwordHash: "$argon2id$existing" });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("EMAIL_REGISTERED");
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

