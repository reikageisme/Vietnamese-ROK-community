import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export class IdentityError extends Error {
  constructor(message: string, readonly status = 400, readonly code = "IDENTITY_ERROR") {
    super(message);
  }
}

export function identityError(error: unknown) {
  if (error instanceof IdentityError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return Response.json({ error: "Dữ liệu không hợp lệ.", issues: error.issues }, { status: 400 });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return Response.json({ error: "Email đã được đăng ký.", code: "EMAIL_REGISTERED" }, { status: 409 });
  }
  if (error instanceof Error && "status" in error && typeof error.status === "number") {
    const message = error.status === 401 ? "Vui lòng đăng nhập để tiếp tục." : "Bạn không có quyền thực hiện thao tác này.";
    return Response.json({ error: message }, { status: error.status });
  }
  console.error("Identity API error", error);
  return Response.json({ error: "Đã xảy ra lỗi. Vui lòng thử lại." }, { status: 500 });
}

export function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
}
