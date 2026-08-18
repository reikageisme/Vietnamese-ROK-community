import { timingSafeEqual } from "node:crypto";

export function authorizeDeviceAgent(request: Request) {
  const expected = process.env.DEVICE_AGENT_TOKEN;
  if (!expected || expected.length < 32) {
    return { ok: false as const, status: 503, error: "Device Agent API chưa được cấu hình." };
  }
  const header = request.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  const valid = expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
  return valid ? { ok: true as const } : { ok: false as const, status: 401, error: "Device Agent token không hợp lệ." };
}

export function isDeviceAgentSurface() {
  return process.env.APP_SURFACE === "ops" || process.env.NODE_ENV !== "production";
}
