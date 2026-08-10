import { Suspense } from "react";
import { Card } from "@/components/ui";
import { ResetPasswordForm } from "@/components/auth-forms";
export default function ResetPasswordPage() { return <div className="signin-page"><Card className="signin-card"><h1>Đặt lại mật khẩu</h1><Suspense><ResetPasswordForm /></Suspense></Card></div>; }
