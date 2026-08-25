import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEquipment } from "@/modules/armory/queries";
import { RARITY_LABELS, SLOT_LABELS, VERIFICATION_LABELS, formatStat, tierLabel } from "@/modules/armory/labels";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const item = await getEquipment((await params).slug);
  return { title: item ? item.name : "Không tìm thấy trang bị" };
}

export default async function EquipmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const item = await getEquipment((await params).slug);
  if (!item) notFound();

  return (
    <div className="data-page">
      <div className="shell data-stack">
        <p className="breadcrumb"><Link href="/armory">← Kho trang bị</Link></p>

        <header className="equipment-head">
          <div>
            <span className={`rarity-pill rarity-${item.rarity.toLowerCase()}`}>
              {RARITY_LABELS[item.rarity] ?? item.rarity}
            </span>
            <h1>{item.name}</h1>
            <p className="equipment-meta">
              {SLOT_LABELS[item.slot] ?? item.slot}
              {item.setName ? <> · Bộ {item.setName}</> : null}
              {item.tiers[0] ? <> · Phiên bản {item.tiers[0].patchVersion}</> : null}
            </p>
          </div>
        </header>

        <section className="data-panel">
          <div className="panel-heading"><div><span className="panel-kicker">BẬC</span><h2>Chỉ số theo từng bậc</h2></div></div>
          <div className="data-table-wrap">
            <table className="data-table tier-table">
              <thead>
                <tr>
                  <th>Bậc</th>
                  {item.columns.map((column) => <th key={column.key} className="num">{column.label}</th>)}
                  <th className="num">Sức mạnh</th>
                  <th>Kiểm chứng</th>
                </tr>
              </thead>
              <tbody>
                {item.tiers.map((tier, index) => {
                  const previous = item.tiers[index - 1];
                  return (
                    <tr key={tier.tier}>
                      <td className="tier-cell"><span className={`tier tier-${tier.tier}`}>{tierLabel(tier.tier)}</span></td>
                      {item.columns.map((column) => {
                        const value = tier.stats[column.key];
                        const before = previous?.stats[column.key];
                        // Cột chênh lệch là lý do bảng này tồn tại: người chơi vào
                        // đây để quyết định có nâng bậc không, không phải để đọc số.
                        const delta = typeof value === "number" && typeof before === "number" ? value - before : null;
                        return (
                          <td key={column.key} className="num">
                            {typeof value === "number" ? formatStat(value, column.kind) : "—"}
                            {delta !== null && delta !== 0 ? (
                              <small className="delta">+{formatStat(delta, column.kind)}</small>
                            ) : null}
                          </td>
                        );
                      })}
                      <td className="num">{tier.powerValue ? new Intl.NumberFormat("vi-VN").format(tier.powerValue) : "—"}</td>
                      <td>
                        <span className={`verify-chip verify-${tier.verification.toLowerCase()}`}>
                          {VERIFICATION_LABELS[tier.verification] ?? tier.verification}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {item.talents.length > 0 ? (
          <section className="data-panel">
            <div className="panel-heading"><div><span className="panel-kicker">TALENT</span><h2>Mở theo bậc</h2></div></div>
            <div className="talent-list">
              {item.talents.map((talent) => (
                <article key={`${talent.unlockTier}-${talent.name}`} className="talent-item">
                  <span className={`tier tier-${talent.unlockTier}`}>{tierLabel(talent.unlockTier)}</span>
                  <div>
                    <h3>
                      {talent.name}
                      {talent.conditional ? <em className="conditional-tag">có điều kiện</em> : null}
                    </h3>
                    {talent.description ? <p>{talent.description}</p> : null}
                    {talent.trigger ? <p className="trigger">Kích hoạt: {talent.trigger}</p> : null}
                  </div>
                  <span className={`verify-chip verify-${talent.verification.toLowerCase()}`}>
                    {VERIFICATION_LABELS[talent.verification] ?? talent.verification}
                  </span>
                </article>
              ))}
            </div>
            <p className="panel-note">
              Talent <b>có điều kiện</b> không được cộng thẳng vào chỉ số nền — bàn thử sẽ tách
              chúng ra một cột riêng.
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
