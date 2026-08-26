import type { Metadata } from "next";
import Link from "next/link";

import { ArmoryExplorer } from "@/components/armory-explorer";
import { listEquipmentFromContent } from "@/modules/armory/content";

export const metadata: Metadata = { title: "Kho trang bị" };

export default function ArmoryLibraryPage() {
  const items = listEquipmentFromContent();
  return (
    <div className="data-page">
      <div className="shell data-stack">
        <p className="breadcrumb"><Link href="/armory">← Bàn thử build</Link></p>
        <section className="data-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">KHO</span><h2>Chỉ số từng bậc đặt cạnh nhau</h2>
              <p>Mỗi món hiện đủ các bậc kèm mức chênh lệch, để trả lời đúng một câu: nâng lên bậc sau có đáng không.</p>
            </div>
          </div>
          <div className="panel-body"><ArmoryExplorer items={items} /></div>
        </section>
      </div>
    </div>
  );
}
