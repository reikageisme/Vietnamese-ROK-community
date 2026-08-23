import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ScanServicePortal } from "@/components/scan-service-portal";
import { isPublicDataRequestsEnabled } from "@/modules/scan-service/catalog";

export const metadata: Metadata = { title: "Yêu cầu dữ liệu" };

export default async function ScansPage() {
  if (!isPublicDataRequestsEnabled()) notFound();
  const session = await auth();
  return <div className="data-page scan-service-page">
    <section className="data-hero compact-hero"><div className="shell data-hero-inner"><div><span className="data-eyebrow"><i /> DỊCH VỤ DỮ LIỆU</span><h1>Bạn chọn Kingdom<br/><em>ROK FAQ xử lý dữ liệu</em></h1><p>Chọn vương quốc và loại báo cáo, phần còn lại chúng tôi lo. Bạn theo dõi tiến độ ngay trong tài khoản.</p></div><div className="service-hero-card"><span>YÊU CẦU</span><b>KD 2812</b><i>→</i><strong>ĐÃ XÁC MINH</strong></div></div></section>
    <div className="shell data-stack"><ScanServicePortal signedIn={Boolean(session?.user?.id)} /></div>
  </div>;
}
