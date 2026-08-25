import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EquipmentPanel, type StatLabelMap } from "@/components/equipment-panel";
import { allEquipment, findEquipment, isDemo, statDefinitions, toSource } from "@/modules/armory/content";
import { RARITY_LABELS, SLOT_LABELS, VERIFICATION_LABELS } from "@/modules/armory/labels";

export function generateStaticParams() {
  return allEquipment().map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const item = findEquipment((await params).slug);
  return { title: item ? item.nameVi : "Không tìm thấy trang bị" };
}

export default async function EquipmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const file = findEquipment((await params).slug);
  if (!file) notFound();

  const source = toSource(file);
  const statLabels: StatLabelMap = Object.fromEntries(
    statDefinitions().map((stat) => [stat.key, { label: stat.vi, kind: stat.kind }]),
  );
  const verification = file.verification ?? "UNVERIFIED";

  return (
    <div className="data-page">
      <div className="shell data-stack">
        <p className="breadcrumb"><Link href="/armory">← Kho trang bị</Link></p>

        <header className="equipment-head">
          <div>
            <span className={`rarity-pill rarity-${file.rarity.toLowerCase()}`}>
              {RARITY_LABELS[file.rarity] ?? file.rarity}
            </span>
            <h1>{file.nameVi}</h1>
            <p className="equipment-meta">
              {SLOT_LABELS[file.slot] ?? file.slot}
              {file.equipmentLevel ? <> · Cấp độ trang bị {file.equipmentLevel}</> : null}
              {file.patch ? <> · Phiên bản {file.patch}</> : null}
              {file.seasonLimited ? <> · <b>Giới hạn theo mùa</b></> : null}
            </p>
            <p className="equipment-meta">
              <span className={`verify-chip verify-${verification.toLowerCase()}`}>
                {VERIFICATION_LABELS[verification] ?? verification}
              </span>
            </p>
          </div>
        </header>

        <EquipmentPanel source={source} statLabels={statLabels} isDemo={isDemo(file)} />
      </div>
    </div>
  );
}
