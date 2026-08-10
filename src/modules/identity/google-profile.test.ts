import { describe, expect, it, vi } from "vitest";
import { googleProviderProfile, newGoogleUserData, syncExistingGoogleUser } from "./google-profile";

const profile = { sub: "google-sub-123", name: "Rok Player", email: "rok@example.com", image: "https://example.com/a.png" };

describe("Google identity mapping", () => {
  it("preserves verified sub separately from Auth core's replaceable user id", () => {
    const mapped = googleProviderProfile({ sub: profile.sub, name: profile.name, email: profile.email, picture: profile.image });
    expect(mapped.googleSub).toBe(profile.sub);
  });

  it("creates a first-time user with the verified subject and MEMBER role", () => {
    const data = newGoogleUserData(profile);
    expect(data.googleSub).toBe(profile.sub);
    expect(data.roles.create.role).toBe("MEMBER");
  });

  it("updates the existing user instead of creating a duplicate", async () => {
    const updateProfile = vi.fn(async () => undefined);
    const found = await syncExistingGoogleUser({
      findByGoogleSub: vi.fn(async () => ({ id: "existing-user" })),
      updateProfile,
    }, profile);
    expect(found).toBe(true);
    expect(updateProfile).toHaveBeenCalledOnce();
    expect(updateProfile).toHaveBeenCalledWith("existing-user", expect.not.objectContaining({ sub: expect.anything() }));
  });

  it("does not update when this is the first login", async () => {
    const updateProfile = vi.fn(async () => undefined);
    const found = await syncExistingGoogleUser({ findByGoogleSub: vi.fn(async () => null), updateProfile }, profile);
    expect(found).toBe(false);
    expect(updateProfile).not.toHaveBeenCalled();
  });
});
