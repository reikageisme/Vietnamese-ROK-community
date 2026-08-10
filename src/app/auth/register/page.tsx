import { Card } from "@/components/ui";
import { RegisterForm } from "@/components/auth-forms";
export default function RegisterPage() { return <div className="signin-page"><Card className="signin-card auth-card-wide"><div className="signin-mark">RV</div><h1>Tạo tài khoản</h1><p>Tham gia RokViet Hub bằng email của bạn.</p><RegisterForm /></Card></div>; }
