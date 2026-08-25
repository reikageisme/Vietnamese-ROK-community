import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Quy tắc cộng đồng" };

export default function CommunityGuidelinesPage() {
  return <div className="shell page narrow-page legal-page"><div className="page-intro"><p className="eyebrow">CỘNG ĐỒNG</p><h1>Quy tắc ROK FAQ</h1><p>Không gian trao đổi thực tế, tôn trọng và hữu ích cho người chơi Rise of Kingdoms.</p></div>
    <section className="card legal-card"><h2>1. Tôn trọng người khác</h2><p>Không công kích cá nhân, quấy rối, phân biệt đối xử, doxxing hoặc kích động cộng đồng tấn công một cá nhân hay liên minh.</p><h2>2. Nội dung có căn cứ</h2><p>Phân biệt rõ kinh nghiệm cá nhân, suy luận và dữ liệu đã xác minh. Không giả mạo số liệu, ảnh hoặc tuyên bố đại diện cho Lilith Games.</p><h2>3. Không gian lận và mua bán rủi ro</h2><p>Không chia sẻ mã độc, thông tin đăng nhập, cách chiếm tài khoản, lừa đảo thanh toán hoặc hướng dẫn né cơ chế bảo vệ của trò chơi.</p><h2>4. Đăng đúng nơi</h2><p>Chọn chuyên mục phù hợp, đặt tiêu đề rõ ràng, tránh spam và dùng chức năng báo cáo thay vì tranh cãi kéo dài.</p><h2>5. Kiểm duyệt</h2><p>Điều hành viên có thể khóa, ẩn hoặc gỡ nội dung vi phạm. Hành động kiểm duyệt được lưu nhật ký nội bộ.</p><p><Link className="text-link" href="/forum/feedback">Góp ý hoặc báo lỗi tại chuyên mục cộng đồng →</Link></p></section>
  </div>;
}
