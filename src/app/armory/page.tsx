import type { Metadata } from "next";
import Link from "next/link";

import { BuildLab } from "@/components/build-lab";
import { labData } from "@/modules/armory/content";

export const metadata: Metadata = { title: "Bàn thử build" };

export default function ArmoryPage() {
  // Đọc thẳng từ `content/armory`, không qua cơ sở dữ liệu: một trang tra cứu
  // không đáng phải chờ migration chạy xong mới có dữ liệu.
  const data = labData();

  return (
    <div className="data-page">
      <section className="data-hero compact-hero">
        <div className="shell data-hero-inner">
          <div>
            <span className="data-eyebrow"><i /> BÀN THỬ BUILD</span>
            <h1>Lắp thử một bộ<br /><em>trước khi tốn vật liệu</em></h1>
            <p>
              Chọn chỉ huy, trang bị từng bậc, minh văn và đội hình. Bảng chỉ số cộng lại theo
              thời gian thực, và bấm được vào từng dòng để xem con số đó từ đâu ra.
            </p>
          </div>
        </div>
      </section>

      <div className="shell data-stack">
        <p className="lab-banner">
          Dữ liệu đang là <b>bản mẫu</b>: tên món và tên kỹ năng đọc từ ảnh chụp trong game, nhưng
          mọi con số là số bịa để dựng giao diện. Mỗi dòng đều tự khai mức kiểm chứng của nó.
          {" "}<Link href="/armory/kho">Xem toàn bộ kho trang bị →</Link>
        </p>
        <BuildLab data={data} />
      </div>
    </div>
  );
}
