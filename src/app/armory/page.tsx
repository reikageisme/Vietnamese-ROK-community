import type { Metadata } from "next";
import { ArmoryExplorer } from "@/components/armory-explorer";
import { listEquipmentFromContent } from "@/modules/armory/content";

export const metadata: Metadata = { title: "Kho trang bị" };

export default function ArmoryPage() {
  // Đọc thẳng từ `content/armory`, không qua cơ sở dữ liệu: trang tra cứu tĩnh
  // không đáng phải chờ migration chạy xong mới có dữ liệu.
  const items = listEquipmentFromContent();

  return (
    <div className="data-page">
      <section className="data-hero compact-hero">
        <div className="shell data-hero-inner">
          <div>
            <span className="data-eyebrow"><i /> KHO TRANG BỊ</span>
            <h1>Chỉ số từng bậc<br /><em>đặt cạnh nhau</em></h1>
            <p>
              Mỗi món hiện đủ các bậc kèm mức chênh lệch, để trả lời đúng một câu:
              nâng lên bậc sau có đáng không.
            </p>
          </div>
        </div>
      </section>
      <div className="shell data-stack">
        <ArmoryExplorer items={items} />
      </div>
    </div>
  );
}
