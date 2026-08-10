import { NextResponse } from "next/server";
import { AuthenticationError, AuthorizationError, EmailVerificationRequiredError } from "@/lib/auth-guards";
import { ZodError } from "zod";

export function forumError(error: unknown) {
  if (error instanceof EmailVerificationRequiredError) return NextResponse.json({ error: "Vui lòng xác thực email trước khi đăng bài, trả lời hoặc báo cáo.", code: "EMAIL_VERIFICATION_REQUIRED" }, { status: 403 });
  if (error instanceof AuthenticationError) return NextResponse.json({ error: "Vui lòng đăng nhập để tiếp tục." }, { status: 401 });
  if (error instanceof AuthorizationError) return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này." }, { status: 403 });
  if (error instanceof ZodError) return NextResponse.json({ error: "Dữ liệu không hợp lệ.", issues: error.issues }, { status: 400 });
  console.error("Forum API error", error);
  return NextResponse.json({ error: "Đã xảy ra lỗi. Vui lòng thử lại." }, { status: 500 });
}

export function voteScore(votes: Array<{ value: number }>) {
  return votes.reduce((total, vote) => total + vote.value, 0);
}

export function canModerate(role: string) {
  return role === "MODERATOR" || role === "ADMIN";
}
