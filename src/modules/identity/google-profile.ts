export type VerifiedGoogleProfile = {
  sub: string;
  name: string | null;
  email: string;
  image: string | null;
};

export function googleProviderProfile(profile: { sub: string; name?: string | null; email: string; email_verified?: boolean; picture?: string | null }) {
  if (profile.email_verified === false) throw new Error("Google email is not verified");
  return {
    id: profile.sub,
    googleSub: profile.sub,
    name: profile.name ?? null,
    email: profile.email,
    image: profile.picture ?? null,
  };
}

export function newGoogleUserData(profile: VerifiedGoogleProfile) {
  return {
    googleSub: profile.sub,
    name: profile.name,
    displayName: profile.name,
    email: profile.email,
    image: profile.image,
    emailVerified: new Date(),
    loginMethods: ["google"],
    roles: { create: { role: "MEMBER" as const } },
  };
}

type ExistingGoogleUserStore = {
  findByGoogleSub(sub: string): Promise<{ id: string } | null>;
  updateProfile(id: string, profile: Omit<VerifiedGoogleProfile, "sub">): Promise<void>;
};

export async function syncExistingGoogleUser(store: ExistingGoogleUserStore, profile: VerifiedGoogleProfile) {
  const existing = await store.findByGoogleSub(profile.sub);
  if (!existing) return false;
  const { sub: _verifiedSubject, ...publicProfile } = profile;
  void _verifiedSubject;
  await store.updateProfile(existing.id, publicProfile);
  return true;
}
