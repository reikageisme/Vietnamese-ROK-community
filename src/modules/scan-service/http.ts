import { ZodError } from "zod";
import { AuthenticationError, AuthorizationError } from "@/lib/auth-guards";

export class InsufficientCreditsError extends Error {}

export function scanServiceError(error: unknown) {
  if (error instanceof ZodError) return Response.json({ error: error.issues[0]?.message ?? "Dữ liệu không hợp lệ." }, { status: 400 });
  if (error instanceof AuthenticationError) return Response.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  if (error instanceof AuthorizationError) return Response.json({ error: "Bạn không có quyền thực hiện thao tác này." }, { status: 403 });
  if (error instanceof InsufficientCreditsError) return Response.json({ error: "Số dư credit không đủ. Hãy tạo yêu cầu nạp trước." }, { status: 409 });
  console.error(error);
  return Response.json({ error: "Hệ thống đang bận, vui lòng thử lại." }, { status: 500 });
}
