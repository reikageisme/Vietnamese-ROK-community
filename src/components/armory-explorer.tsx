"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ArmoryListItem } from "@/modules/armory/queries";
import { RARITY_LABELS, SLOT_LABELS, VERIFICATION_LABELS, formatStat, tierLabel } from "@/modules/armory/labels";

const SLOTS = ["HELMET", "CHEST", "WEAPON", "GLOVES", "LEGS", "BOOTS", "ACCESSORY"];

export function ArmoryExplorer({ items }: { items: ArmoryListItem[] }) {
  const [query, setQuery] = useState("");
  const [slot, setSlot] = useState("");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter(
      (item) =>
        (!slot || item.slot === slot) &&
        (!needle || item.name.toLowerCase().includes(needle) || item.slug.includes(needle)),
    );
  }, [items, query, slot]);

  const unverified = items.filter((item) => item.weakestVerification === "UNVERIFIED").length;

  return (
    <>
      {unverified > 0 ? (
        <p className="armory-warning">
          <b>{unverified}</b> món đang ở mức <i>chưa kiểm chứng</i>. Số hiển thị chỉ dùng để tham khảo
          cho tới khi có ảnh chụp trong game đối chiếu.
        </p>
      ) : null}

      <div className="armory-controls">
        <label className="search">
          <span aria-hidden>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo tên trang bị"
            aria-label="Tìm theo tên trang bị"
          />
        </label>
        <div className="armory-slots" role="group" aria-label="Lọc theo ô mặc">
          <button className={slot === "" ? "active" : ""} onClick={() => setSlot("")}>Tất cả</button>
          {SLOTS.map((value) => (
            <button key={value} className={slot === value ? "active" : ""} onClick={() => setSlot(value)}>
              {SLOT_LABELS[value] ?? value}
            </button>
          ))}
        </div>
      </div>

      <p className="armory-count">{rows.length} / {items.length} món</p>

      {rows.length === 0 ? (
        <p className="empty-state">
          Chưa có món nào khớp. Kho trang bị được nhập dần từ ảnh chụp trong game.
        </p>
      ) : (
        <div className="armory-grid">
          {rows.map((item) => (
            <Link className="armory-card" key={item.slug} href={`/armory/${item.slug}`}>
              <div className="armory-card-head">
                <span className={`rarity-pill rarity-${item.rarity.toLowerCase()}`}>
                  {RARITY_LABELS[item.rarity] ?? item.rarity}
                </span>
                <span className="armory-slot">{SLOT_LABELS[item.slot] ?? item.slot}</span>
              </div>
              <h2>{item.name}</h2>
              {item.setName ? <p className="armory-set">Bộ {item.setName}</p> : null}
              <ul className="armory-stats">
                {item.topStats.map((stat) => (
                  <li key={stat.key}>
                    <span>{stat.label}</span>
                    <b>{formatStat(stat.value, stat.kind)}</b>
                  </li>
                ))}
              </ul>
              <div className="armory-card-foot">
                <span>Tối đa bậc {tierLabel(item.maxTier)}</span>
                <span className={`verify-chip verify-${item.weakestVerification.toLowerCase()}`}>
                  {VERIFICATION_LABELS[item.weakestVerification] ?? item.weakestVerification}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
