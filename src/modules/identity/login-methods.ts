export type LoginMethod = "google" | "credentials";

export function addLoginMethod(methods: string[], method: LoginMethod) {
  return Array.from(new Set([...methods, method]));
}

export function removeLoginMethod(methods: string[], method: LoginMethod) {
  if (!methods.includes(method)) return { ok: false as const, code: "METHOD_NOT_FOUND", methods };
  if (methods.length <= 1) return { ok: false as const, code: "LAST_LOGIN_METHOD", methods };
  return { ok: true as const, methods: methods.filter((item) => item !== method) };
}

