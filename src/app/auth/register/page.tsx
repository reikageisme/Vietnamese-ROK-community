import { Card } from "@/components/ui";
import { RegisterForm } from "@/components/auth-forms";
export default function RegisterPage() { return <div className="signin-page"><Card className="signin-card auth-card-wide"><div className="signin-mark">RF</div><h1>Tạo tài khoản</h1><p>Tham gia ROK FAQ bằng email của bạn.</p><RegisterForm /></Card></div>; }
