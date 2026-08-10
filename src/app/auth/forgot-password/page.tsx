import { Card } from "@/components/ui";
import { ForgotPasswordForm } from "@/components/auth-forms";
export default function ForgotPasswordPage() { return <div className="signin-page"><Card className="signin-card"><h1>Quên mật khẩu</h1><p>Nhập email để nhận liên kết đặt lại mật khẩu.</p><ForgotPasswordForm /></Card></div>; }
