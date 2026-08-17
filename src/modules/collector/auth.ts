import { timingSafeEqual } from "node:crypto";

export function authorizeCollector(request: Request) {
  const expected = process.env.COLLECTOR_API_TOKEN;
  if (!expected || expected.length < 24) return { ok: false as const, status: 503, error: "Collector API chưa được cấu hình." };
  const header = request.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  const valid = expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
  return valid ? { ok: true as const } : { ok: false as const, status: 401, error: "Collector token không hợp lệ." };
}
