import type { Metadata } from "next";
import { auth } from "@/auth";
import { ScanServicePortal } from "@/components/scan-service-portal";

export const metadata: Metadata = { title: "Dịch vụ quét" };

export default async function ScansPage() {
  const session = await auth();
  return <div className="data-page scan-service-page">
    <section className="data-hero compact-hero"><div className="shell data-hero-inner"><div><span className="data-eyebrow"><i /> DỊCH VỤ QUÉT</span><h1>Bạn chọn Kingdom<br/><em>RokViet xử lý dữ liệu</em></h1><p>Nạp credit, gửi yêu cầu và theo dõi tiến độ trong tài khoản. Thông tin thiết bị và quy trình vận hành không được công khai.</p></div><div className="service-hero-card"><span>YÊU CẦU</span><b>KD 2812</b><i>→</i><strong>ĐÃ XÁC MINH</strong></div></div></section>
    <div className="shell data-stack"><ScanServicePortal signedIn={Boolean(session?.user?.id)} /></div>
  </div>;
}
