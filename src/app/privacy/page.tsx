import type { Metadata } from "next";

export const metadata: Metadata = { title: "Chính sách riêng tư" };

export default function PrivacyPage() {
  return <div className="shell page narrow-page legal-page"><div className="page-intro"><p className="eyebrow">RIÊNG TƯ</p><h1>Chính sách dữ liệu</h1><p>Bản tóm tắt minh bạch về dữ liệu tài khoản và nội dung cộng đồng.</p></div>
    <section className="card legal-card"><h2>Dữ liệu tài khoản</h2><p>ROK FAQ lưu email, tên hiển thị, ảnh đại diện Google nếu bạn cho phép, phương thức đăng nhập và phiên đăng nhập cần thiết để vận hành tài khoản.</p><h2>Nội dung cộng đồng</h2><p>Chủ đề, câu trả lời, bình chọn, bookmark, báo cáo và lịch sử chỉnh sửa được lưu để cung cấp forum và chống lạm dụng.</p><h2>Dữ liệu trò chơi công khai</h2><p>Dashboard chỉ công bố số liệu tổng hợp hoặc hồ sơ trong game đã qua quy trình kiểm tra. Không công bố token, cấu hình vận hành hay thông tin đăng nhập trò chơi.</p><h2>Bảo mật</h2><p>Mật khẩu được băm; token xác thực có thời hạn. Không chia sẻ mật khẩu, mã OTP hoặc token cho bất kỳ ai tự xưng là quản trị viên.</p><h2>Yêu cầu hỗ trợ</h2><p>Bạn có thể liên hệ qua trang Liên hệ để yêu cầu chỉnh sửa thông tin hồ sơ hoặc báo cáo vấn đề riêng tư.</p></section>
  </div>;
}
