"use client";

import { useMemo, useState } from "react";

import { formatStat, tierLabel } from "@/modules/armory/labels";
import {
  resolveAllTiers,
  resolveEquipment,
  type EquipmentSource,
  type TroopType,
} from "@/modules/armory/equipment-model";

/** Panel trang bị, dựng theo đúng bố cục người chơi đã quen trong game.
 *
 * Hai khối tách bạch — Thuộc Tính Trang Bị và Thuộc Tính Biểu Trưng — vì game
 * bày như vậy và người chơi tra theo đúng thứ tự đó. Gộp lại cho gọn là bắt họ
 * học lại một bố cục mới để đọc cùng một thứ.
 *
 * Ba thứ web làm được mà game không làm: đổi bậc để xem trước KHÔNG cần vật
 * liệu, cột chênh lệch so với bậc liền trước, và bảng cả năm bậc cạnh nhau.
 */

export type StatLabelMap = Record<string, { label: string; kind: "FLAT" | "PERCENT" }>;

const TROOP_LABELS: Record<TroopType, string> = {
  infantry: "Bộ binh",
  cavalry: "Kỵ binh",
  archer: "Cung thủ",
  siege: "Công thành",
};

function signed(value: number, kind: "FLAT" | "PERCENT"): string {
  const text = formatStat(Math.abs(value), kind);
  return value < 0 ? `−${text}` : `+${text}`;
}

export function EquipmentPanel({
  source,
  statLabels,
  isDemo = false,
}: {
  source: EquipmentSource;
  statLabels: StatLabelMap;
  isDemo?: boolean;
}) {
  const maxTier = source.maxTier ?? 5;
  const [tier, setTier] = useState(maxTier);
  const [talentOn, setTalentOn] = useState(false);

  const troopType = source.specialTalent?.troopType ?? null;
  const resolved = useMemo(
    () =>
      resolveEquipment(source, {
        tier,
        commanderTroopType: talentOn ? troopType : null,
      }),
    [source, tier, talentOn, troopType],
  );
  const allTiers = useMemo(
    () => resolveAllTiers(source, { commanderTroopType: talentOn ? troopType : null }),
    [source, talentOn, troopType],
  );

  const meta = (key: string) => statLabels[key] ?? { label: key, kind: "PERCENT" as const };

  return (
    <div className="gear-panel">
      {isDemo ? (
        <p className="gear-demo-flag">
          Đây là <b>dữ liệu mẫu</b> để xem trước bố cục. Số trong này không phải số trong game.
        </p>
      ) : null}

      <div className="gear-tier-picker" role="group" aria-label="Chọn bậc trang bị">
        {Array.from({ length: maxTier }, (_, index) => index + 1).map((value) => (
          <button
            key={value}
            type="button"
            className={value === resolved.tier ? "active" : undefined}
            aria-pressed={value === resolved.tier}
            onClick={() => setTier(value)}
          >
            {tierLabel(value)}
          </button>
        ))}
      </div>

      <section className="gear-block">
        <h3>Thuộc Tính Trang Bị</h3>
        {resolved.baseStats.length === 0 ? (
          <p className="gear-empty">Chưa nhập chỉ số nền cho món này.</p>
        ) : (
          <ul className="gear-lines">
            {resolved.baseStats.map((line) => {
              const info = meta(line.statKey);
              return (
                <li key={line.statKey}>
                  <span className="gear-line-name">{info.label}</span>
                  <span className="gear-line-value">
                    {signed(line.value, info.kind)}
                    {line.perTier !== 0 ? (
                      <em className="gear-growth">{signed(line.perTier, info.kind)}</em>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="gear-block">
        <h3>Thuộc Tính Biểu Trưng</h3>
        {resolved.iconic.length === 0 ? (
          <p className="gear-empty">Món này chưa có thuộc tính biểu trưng nào được nhập.</p>
        ) : (
          <ol className="gear-iconic">
            {resolved.iconic.map((entry) => {
              const info = entry.statKey ? meta(entry.statKey) : null;
              return (
                <li key={entry.level} className={entry.unlocked ? undefined : "locked"}>
                  <span className={`gear-roman tier-${entry.level}`}>{tierLabel(entry.level)}</span>
                  <div className="gear-iconic-body">
                    <span className="gear-line-name">
                      {info ? info.label : entry.nameVi ?? "—"}
                      {entry.conditional ? <em className="gear-cond">có điều kiện</em> : null}
                    </span>
                    {entry.descriptionVi ? <p>{entry.descriptionVi}</p> : null}
                    {!entry.unlocked ? (
                      <p className="gear-locked-note">Mở ở bậc {tierLabel(entry.level)}.</p>
                    ) : null}
                  </div>
                  {info && typeof entry.value === "number" ? (
                    <span className="gear-line-value">
                      {signed(entry.value, info.kind)}
                      {entry.perTier ? (
                        <em className="gear-growth">{signed(entry.perTier, info.kind)}</em>
                      ) : null}
                    </span>
                  ) : (
                    <span className="gear-line-value muted">—</span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {source.specialTalent ? (
        <section className="gear-block gear-special">
          <h3>Tài năng đặc biệt ({TROOP_LABELS[source.specialTalent.troopType]})</h3>
          <p>
            {source.specialTalent.descriptionVi ??
              `Khi được trang bị bởi một chỉ huy có tài năng ${TROOP_LABELS[source.specialTalent.troopType]}, thuộc tính trang bị của món này tăng ${source.specialTalent.bonusPercent}%.`}
          </p>
          <label className="gear-toggle">
            <input
              type="checkbox"
              checked={talentOn}
              onChange={(event) => setTalentOn(event.target.checked)}
            />
            <span>
              Tính như đang lắp cho chỉ huy {TROOP_LABELS[source.specialTalent.troopType]} (+
              {source.specialTalent.bonusPercent}%)
            </span>
          </label>
        </section>
      ) : null}

      <section className="gear-block">
        <h3>So sánh cả {maxTier} bậc</h3>
        <p className="gear-block-note">
          Cột <b>chênh</b> là phần bậc này hơn bậc liền trước — con số cần nhìn khi cân nhắc có
          nâng hay không.
        </p>
        <div className="data-table-wrap">
          <table className="data-table tier-table">
            <thead>
              <tr>
                <th>Bậc</th>
                {resolved.baseStats.map((line) => (
                  <th key={line.statKey} className="num">
                    {meta(line.statKey).label}
                  </th>
                ))}
                <th className="num">Biểu trưng đã mở</th>
              </tr>
            </thead>
            <tbody>
              {allTiers.map((row) => (
                <tr key={row.tier} className={row.tier === resolved.tier ? "is-current" : undefined}>
                  <td className="tier-cell">
                    <span className={`tier tier-${row.tier}`}>{tierLabel(row.tier)}</span>
                  </td>
                  {row.baseStats.map((line) => {
                    const info = meta(line.statKey);
                    return (
                      <td key={line.statKey} className="num">
                        {signed(line.value, info.kind)}
                        {row.tier > 1 && line.delta !== 0 ? (
                          <small className="delta">{signed(line.delta, info.kind)}</small>
                        ) : null}
                      </td>
                    );
                  })}
                  <td className="num">
                    {row.iconic.filter((entry) => entry.unlocked).length} / {row.iconic.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {resolved.warnings.length > 0 ? (
        <ul className="gear-warnings">
          {resolved.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
