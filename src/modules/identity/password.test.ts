import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("uses a one-way Argon2id hash", async () => {
    const plaintext = "strong-password-123";
    const digest = await hashPassword(plaintext);
    expect(digest).toMatch(/^\$argon2id\$/);
    expect(digest).not.toContain(plaintext);
    expect(await verifyPassword(digest, plaintext)).toBe(true);
    expect(await verifyPassword(digest, "wrong-password-123")).toBe(false);
  });
});
