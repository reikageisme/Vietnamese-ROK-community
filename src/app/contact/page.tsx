import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Liên hệ" };

export default function ContactPage() {
  return <div className="shell page narrow-page legal-page"><div className="page-intro"><p className="eyebrow">ROKVIET HUB</p><h1>Liên hệ cộng đồng</h1><p>Chọn đúng kênh để yêu cầu được xử lý nhanh và có lịch sử minh bạch.</p></div>
    <div className="contact-grid"><Link className="card contact-card" href="/forum/feedback"><strong>Góp ý & báo lỗi</strong><p>Đăng vấn đề công khai để cộng đồng cùng theo dõi và bổ sung thông tin.</p><span>Mở chuyên mục →</span></Link><Link className="card contact-card" href="/community-guidelines"><strong>Quy tắc cộng đồng</strong><p>Xem cách báo cáo nội dung và nguyên tắc điều hành diễn đàn.</p><span>Xem quy tắc →</span></Link><Link className="card contact-card" href="/profile/security"><strong>Tài khoản & bảo mật</strong><p>Quản lý Google, mật khẩu và trạng thái xác thực email.</p><span>Mở bảo mật →</span></Link></div>
  </div>;
}
