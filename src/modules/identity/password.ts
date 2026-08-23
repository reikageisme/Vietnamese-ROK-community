import { hash, verify } from "@node-rs/argon2";

// OWASP's Argon2id profile: 19 MiB memory, 2 iterations, parallelism 1.
const options = {
  algorithm: 2 as const,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

let dummyHash: Promise<string> | undefined;

export function hashPassword(password: string) {
  return hash(password, options);
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Spend approximately the same Argon2 work for an unknown email. */
export async function verifyDummyPassword(password: string) {
  dummyHash ??= hashPassword("rokfaq-dummy-credential-2026");
  return verifyPassword(await dummyHash, password);
}
