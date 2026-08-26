"use client";

import { useCallback, useMemo, useState } from "react";

import { formatStat, tierLabel } from "@/modules/armory/labels";
import {
  POSITIONS, POSITION_LABEL, POSITION_SLOT,
  computeSheet, emptyLoadout, estimatePower, skillSegments,
  type LabCommander, type LabData, type Loadout, type Position,
} from "@/modules/armory/lab";

/** Bàn thử build.
 *
 * Bố cục theo đúng panel trong game: tám ô trang bị xếp thành mảng hình thoi,
 * đội hình ngay dưới, cặp chỉ huy và kỹ năng bên trái, bảng chỉ số bên phải.
 * Người chơi đã quen đọc theo thứ tự đó; bày lại cho gọn là bắt họ học lại một
 * bố cục mới để tra cùng một thứ.
 *
 * Bảng chỉ số bấm được vào từng dòng để xem con số đó từ đâu ra. Đó là lý do
 * trang này tồn tại — một con số không nói mình từ đâu thì không kiểm được.
 */

const RARITY_VI: Record<string, string> = {
  LEGENDARY: "Huyền thoại", EPIC: "Sử thi", ELITE: "Tinh nhuệ",
  ADVANCED: "Cao cấp", NORMAL: "Thường",
};
const RARITY_FRAME: Record<string, string> = {
  LEGENDARY: "legendary", EPIC: "epic", ELITE: "elite", ADVANCED: "advanced", NORMAL: "advanced",
};
const RARITY_RING: Record<string, string> = {
  LEGENDARY: "gold", EPIC: "pink", ELITE: "silver", ADVANCED: "silver", NORMAL: "silver",
};
const TROOP_VI: Record<string, string> = {
  infantry: "Bộ binh", cavalry: "Kỵ binh", archer: "Cung thủ",
  siege: "Công thành", leadership: "Lãnh đạo", integration: "Kết hợp",
};
const ROLE_VI: Record<string, string> = {
  versatile: "Đa năng", garrison: "Đồn trú", conquest: "Chinh phạt",
  peace: "Giữ hoà bình", gather: "Thu thập",
};
const GROUP_VI: Record<string, string> = {
  all_troops: "Toàn quân", infantry: "Bộ binh", cavalry: "Kỵ binh", archer: "Cung thủ",
  siege: "Công thành", combat: "Chiến đấu", march: "Hành quân", economy: "Phát triển",
};

/** Toạ độ mảng hình thoi, tính theo ô. Cột giữa chồng đỉnh chạm đỉnh, hai cặp
 *  bên nêm vào khe — giống hệt panel trang bị trong game. */
const RIG: Record<Position, [number, number]> = {
  helmet: [0, 0], chest: [0, 1],
  weapon: [-0.5, 1.5], gloves: [0.5, 1.5],
  legs: [0, 2],
  acc1: [-0.5, 2.5], acc2: [0.5, 2.5],
  boots: [0, 3],
};
const D = 88, STEP_Y = 96, OFF_X = 92, PAD = 22;

const signed = (value: number, kind: "FLAT" | "PERCENT") =>
  (value < 0 ? "−" : "+") + formatStat(Math.abs(value), kind);

function HexPortrait({ commander, size }: { commander: LabCommander; size: number }) {
  const frame = RARITY_FRAME[commander.rarity] ?? "advanced";
  const ring = RARITY_RING[commander.rarity] ?? "silver";
  return (
    <span className="hex" style={{ width: size, height: size }}>
      <img className="hex-bg" src={`/game/frame/${frame}.png`} alt="" />
      {commander.art
        ? <img className="hex-art" src={`/game/hero/${commander.art}.png`} alt="" />
        : <span className="hex-empty">chưa có ảnh</span>}
      <img className="hex-ring" src={`/game/frame/ring-${ring}.png`} alt="" />
    </span>
  );
}

type Dialog =
  | { kind: "commander"; role: "primary" | "secondary" }
  | { kind: "equip"; position: Position }
  | null;

export function BuildLab({ data }: { data: LabData }) {
  const [loadout, setLoadout] = useState<Loadout>(() => {
    const start = emptyLoadout();
    start.primary = data.commanders[0]?.slug ?? null;
    start.formation = data.formations[0]?.slug ?? null;
    for (const position of POSITIONS) {
      const item = data.equipment.find((e) => e.slot === POSITION_SLOT[position]);
      // Hai ô phụ kiện cùng loại ô, nên phải tránh lắp trùng một món vào cả hai.
      if (position === "acc2") {
        const other = data.equipment.filter((e) => e.slot === "ACCESSORY")[1];
        if (other) start.equip[position].slug = other.slug;
        continue;
      }
      if (item) start.equip[position].slug = item.slug;
    }
    return start;
  });
  const [focus, setFocus] = useState<Position>("helmet");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [openStat, setOpenStat] = useState<string | null>(null);
  const [skillIndex, setSkillIndex] = useState(0);
  const [skillLevels, setSkillLevels] = useState<number[]>([5, 5, 5, 5, 1]);
  const [filters, setFilters] = useState<{ rarity: string[]; troop: string[]; art: string[] }>(
    { rarity: [], troop: [], art: [] },
  );

  const sheet = useMemo(() => computeSheet(data, loadout), [data, loadout]);
  const power = useMemo(() => estimatePower(sheet), [sheet]);
  const primary = data.commanders.find((c) => c.slug === loadout.primary) ?? null;
  const statMeta = useCallback(
    (key: string) => data.statDefinitions.find((s) => s.key === key) ?? null,
    [data.statDefinitions],
  );
  const statLabel = useCallback(
    (key: string) => data.statLabels?.[key] ?? key,
    [data],
  );

  const update = (change: (draft: Loadout) => void) =>
    setLoadout((current) => {
      const next: Loadout = {
        ...current,
        equip: Object.fromEntries(
          POSITIONS.map((p) => [p, { ...current.equip[p] }]),
        ) as Loadout["equip"],
      };
      change(next);
      return next;
    });

  const focusState = loadout.equip[focus];
  const focusItem = focusState.slug
    ? data.equipment.find((e) => e.slug === focusState.slug) ?? null
    : null;

  /* ------------------------------------------------------ danh sách chỉ huy */
  const commanderList = data.commanders.filter((c) =>
    (!filters.rarity.length || filters.rarity.includes(c.rarity)) &&
    (!filters.troop.length || (c.troop != null && filters.troop.includes(c.troop))) &&
    (!filters.art.length || filters.art.includes(c.art ? "yes" : "no")));

  const toggleFilter = (group: keyof typeof filters, value: string) =>
    setFilters((current) => ({
      ...current,
      [group]: current[group].includes(value)
        ? current[group].filter((v) => v !== value)
        : [...current[group], value],
    }));

  return (
    <div className="lab">
      <div className="lab-grid">
        {/* ---------------------------------------------------------- trái */}
        <div className="lab-col">
          <section className="data-panel">
            <div className="panel-heading"><div><span className="panel-kicker">CHỈ HUY</span><h2>Cặp chỉ huy</h2></div></div>
            <div className="panel-body">
              <div className="pair">
                {(["primary", "secondary"] as const).map((role, index) => {
                  const c = data.commanders.find((x) => x.slug === loadout[role]) ?? null;
                  return (
                    <div key={role} className="pair-cell" style={{ order: index * 2 }}>
                      <button className="cmdr" onClick={() => setDialog({ kind: "commander", role })}>
                        <span className="cmdr-role">{role === "primary" ? "Chính" : "Phụ"}</span>
                        {c ? <HexPortrait commander={c} size={86} /> : <span className="ghost-slot">+</span>}
                        <span className="cmdr-name">{c ? c.name : "Chọn chỉ huy"}</span>
                        {c ? (
                          <>
                            <span className="stars">
                              {Array.from({ length: 6 }, (_, i) => (
                                <i key={i} className={i < c.maxStars ? "on" : undefined} />
                              ))}
                            </span>
                            <span className="cmdr-id">{c.art ? `#${c.art}` : "chưa gắn ảnh"}</span>
                          </>
                        ) : null}
                      </button>
                    </div>
                  );
                })}
                <button
                  className="swap" style={{ order: 1 }} aria-label="Đổi chỗ chỉ huy chính và phụ"
                  onClick={() => update((d) => { const t = d.primary; d.primary = d.secondary; d.secondary = t; })}
                >⇄</button>
              </div>
            </div>
          </section>

          <section className="data-panel">
            <div className="panel-heading"><div><span className="panel-kicker">KỸ NĂNG</span><h2>Chỉ huy chính</h2></div></div>
            <div className="panel-body">
              {primary && primary.skills.length ? (
                <>
                  <div className="skill-row">
                    {primary.skills.map((skill, index) => (
                      <button
                        key={skill.order} className="skill" aria-pressed={index === skillIndex}
                        onClick={() => setSkillIndex(index)} title={skill.name}
                      >
                        {skill.art
                          ? <img src={`/game/skill/${skill.art}.png`} alt="" />
                          : <span className="skill-blank" />}
                        <span className="skill-lv">{skillLevels[index] ?? 1}</span>
                      </button>
                    ))}
                  </div>
                  {(() => {
                    const skill = primary.skills[Math.min(skillIndex, primary.skills.length - 1)];
                    const level = skillLevels[skillIndex] ?? 1;
                    return (
                      <div className="skill-detail">
                        <span className="skill-kind">{skill.kind}</span>
                        <h3>{skill.name}</h3>
                        <p>
                          {skillSegments(skill, level).map((part, i) =>
                            part.isValue ? <b key={i}>{part.text}</b> : <span key={i}>{part.text}</span>)}
                        </p>
                        <div className="lv-picker">
                          {[1, 2, 3, 4, 5].map((value) => (
                            <button
                              key={value} aria-pressed={value === level}
                              onClick={() => setSkillLevels((c) => c.map((v, i) => (i === skillIndex ? value : v)))}
                            >{value}</button>
                          ))}
                          <button
                            className="lv-all"
                            onClick={() => setSkillLevels((c) => c.map(() => level))}
                          >Tất cả cấp {level}</button>
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <p className="empty-state">Chỉ huy này chưa có dữ liệu kỹ năng.</p>
              )}
            </div>
          </section>
        </div>

        {/* --------------------------------------------------------- giữa */}
        <div className="lab-col">
          <section className="data-panel">
            <div className="panel-heading"><div><span className="panel-kicker">TRANG BỊ</span><h2>Tám ô</h2></div></div>
            <div className="panel-body">
              <div
                className="rig"
                style={{
                  ["--d" as string]: `${D}px`,
                  ["--rig-w" as string]: `${OFF_X * 2 + D}px`,
                  ["--rig-h" as string]: `${STEP_Y * 3 + D + PAD}px`,
                  ["--spine-w" as string]: `${Math.round(D * 0.66)}px`,
                }}
              >
                <span className="rig-spine" />
                {POSITIONS.map((position) => {
                  const [gx, gy] = RIG[position];
                  const state = loadout.equip[position];
                  const item = state.slug ? data.equipment.find((e) => e.slug === state.slug) : null;
                  const inscription = state.inscription
                    ? data.inscriptions.find((i) => i.slug === state.inscription)
                    : null;
                  return (
                    <button
                      key={position} className="gear" aria-pressed={focus === position}
                      title={POSITION_LABEL[position]}
                      style={{ left: OFF_X + D / 2 + gx * 2 * OFF_X, top: D / 2 + gy * STEP_Y }}
                      onClick={() => { setFocus(position); setDialog({ kind: "equip", position }); }}
                    >
                      <span className="gear-frame" />
                      <span className="gear-icon">
                        {item ? <img src={`/game/equip/${position}.png`} alt="" /> : <span className="gear-plus">+</span>}
                      </span>
                      {item ? <span className="gear-tier">{tierLabel(state.tier)}</span> : null}
                      {inscription ? (
                        <span className="gear-inscription">
                          <img src={`/game/armament/${99 + inscription.art}.png`} alt="" />
                        </span>
                      ) : null}
                      <span className="gear-label">{POSITION_LABEL[position]}</span>
                    </button>
                  );
                })}
              </div>
              <p className="rig-legend">Bấm một ô để đổi trang bị, đổi bậc và gắn minh văn.</p>
            </div>
          </section>

          <section className="data-panel">
            <div className="panel-heading"><div><span className="panel-kicker">ĐỘI HÌNH</span><h2>Chọn một</h2></div></div>
            <div className="panel-body">
              <div className="form-grid">
                {data.formations.map((formation) => (
                  <button
                    key={formation.slug} className="form-card"
                    aria-pressed={loadout.formation === formation.slug}
                    onClick={() => update((d) => { d.formation = formation.slug; })}
                  >
                    <img src={`/game/formation/shape-${formation.art}.png`} alt="" />
                    <span className="form-name">{formation.nameVi}</span>
                    <span className="form-troop">{TROOP_VI[formation.troop] ?? formation.troop}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="data-panel">
            <div className="panel-heading"><div><span className="panel-kicker">CHI TIẾT</span><h2>{POSITION_LABEL[focus]}</h2></div></div>
            <div className="panel-body">
              {focusItem ? <EquipmentDetail
                item={focusItem} state={focusState} position={focus}
                troop={primary?.troop ?? null}
                statLabel={(key) => statLabel(key)} statMeta={statMeta}
                onTier={(tier) => update((d) => { d.equip[focus].tier = tier; })}
              /> : <p className="empty-state">Ô {POSITION_LABEL[focus]} đang trống.</p>}
            </div>
          </section>
        </div>

        {/* --------------------------------------------------------- phải */}
        <div className="lab-col lab-sheet">
          <section className="data-panel">
            <div className="power-row">
              <span>Sức mạnh ước tính</span>
              <b>{new Intl.NumberFormat("vi-VN").format(power)}</b>
            </div>
            <p className="power-note">
              Thang quy ước của trang, <b>không phải</b> chỉ số power trong game — Lilith không
              công bố công thức. Dùng để so hai build với nhau, không phải để so với game.
            </p>
            {sheet.warnings.length ? (
              <ul className="sheet-warnings">
                {sheet.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            ) : null}
            {sheet.lines.length === 0 ? (
              <p className="empty-state">Chưa lắp gì cả.</p>
            ) : (
              Object.entries(
                sheet.lines.reduce<Record<string, typeof sheet.lines>>((groups, line) => {
                  (groups[line.group] ||= []).push(line);
                  return groups;
                }, {}),
              ).map(([group, lines]) => (
                <div key={group} className="stat-group">
                  <h3>{GROUP_VI[group] ?? group}</h3>
                  {lines
                    .slice()
                    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
                    .map((line) => (
                      <div key={line.key}>
                        <button
                          className="stat-line"
                          onClick={() => setOpenStat(openStat === line.key ? null : line.key)}
                        >
                          <span className="stat-name">{statLabel(line.key)}</span>
                          <span className="stat-value">
                            {signed(line.total, line.kind)}
                            {line.conditionalTotal
                              ? <em>{signed(line.conditionalTotal, line.kind)} có đk</em>
                              : null}
                          </span>
                        </button>
                        {openStat === line.key ? (
                          <ul className="stat-sources">
                            {line.contributions.map((c, index) => (
                              <li key={index} className={c.source.conditional ? "cond" : undefined}>
                                <span>{c.source.label}{c.source.conditional ? " · có điều kiện" : ""}</span>
                                <b>{signed(c.value, line.kind)}</b>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                </div>
              ))
            )}
          </section>
        </div>
      </div>

      {/* ------------------------------------------------------------- popup */}
      {dialog?.kind === "commander" ? (
        <Modal
          title={dialog.role === "primary" ? "Chọn chỉ huy chính" : "Chọn chỉ huy phụ"}
          onClose={() => setDialog(null)}
        >
          <div className="filters">
            <div className="filter-row">
              <span>Độ hiếm</span>
              {["LEGENDARY", "EPIC", "ELITE", "ADVANCED"].map((value) => (
                <button
                  key={value} className="chip" aria-pressed={filters.rarity.includes(value)}
                  onClick={() => toggleFilter("rarity", value)}
                >{RARITY_VI[value]}</button>
              ))}
            </div>
            <div className="filter-row">
              <span>Loại đơn vị</span>
              {["infantry", "cavalry", "archer", "siege", "leadership", "integration"].map((value) => (
                <button
                  key={value} className="chip" aria-pressed={filters.troop.includes(value)}
                  onClick={() => toggleFilter("troop", value)}
                >
                  <img src={`/game/troop/${value}.png`} alt="" />
                  {TROOP_VI[value]}
                </button>
              ))}
            </div>
            <div className="filter-row">
              <span>Ảnh</span>
              {[["yes", "Đã gắn ảnh"], ["no", "Chưa gắn ảnh"]].map(([value, label]) => (
                <button
                  key={value} className="chip" aria-pressed={filters.art.includes(value)}
                  onClick={() => toggleFilter("art", value)}
                >{label}</button>
              ))}
            </div>
          </div>
          <p className="pick-count">{commanderList.length} / {data.commanders.length} chỉ huy</p>
          <div className="pick-grid">
            {commanderList.map((c) => (
              <button
                key={c.slug} className="pick" aria-pressed={loadout[dialog.role] === c.slug}
                onClick={() => {
                  update((d) => {
                    const other = dialog.role === "primary" ? "secondary" : "primary";
                    if (d[other] === c.slug) d[other] = d[dialog.role];
                    d[dialog.role] = c.slug;
                  });
                  setSkillIndex(0);
                  setDialog(null);
                }}
              >
                <HexPortrait commander={c} size={68} />
                <span className="pick-name">{c.name}</span>
                {c.troop ? <img className="pick-troop" src={`/game/troop/${c.troop}.png`} alt="" /> : null}
                <span className="pick-sub">
                  {Object.keys(c.stats).length ? RARITY_VI[c.rarity] : "chưa có chỉ số"}
                </span>
              </button>
            ))}
          </div>
        </Modal>
      ) : null}

      {dialog?.kind === "equip" ? (() => {
        const position = dialog.position;
        const state = loadout.equip[position];
        const options = data.equipment.filter((e) => e.slot === POSITION_SLOT[position]);
        return (
          <Modal title={`Ô ${POSITION_LABEL[position]}`} onClose={() => setDialog(null)}>
            <div className="pick-grid">
              {options.map((item) => (
                <button
                  key={item.slug} className="pick" aria-pressed={state.slug === item.slug}
                  onClick={() => update((d) => { d.equip[position].slug = item.slug; })}
                >
                  <span className="gear-mini">
                    <span className="gear-frame" />
                    <span className="gear-icon"><img src={`/game/equip/${position}.png`} alt="" /></span>
                  </span>
                  <span className="pick-name">{item.nameVi}</span>
                  <span className="pick-sub">{RARITY_VI[item.rarity] ?? item.rarity}</span>
                </button>
              ))}
              <button
                className="pick" aria-pressed={!state.slug}
                onClick={() => update((d) => { d.equip[position].slug = null; })}
              >
                <span className="ghost-slot">✕</span>
                <span className="pick-name">Tháo ra</span>
              </button>
            </div>

            {state.slug ? (
              <>
                <p className="pick-section">Bậc</p>
                <div className="tier-picker">
                  {[1, 2, 3, 4, 5].map((tier) => (
                    <button
                      key={tier} aria-pressed={tier === state.tier}
                      onClick={() => update((d) => { d.equip[position].tier = tier; })}
                    >{tierLabel(tier)}</button>
                  ))}
                </div>
              </>
            ) : null}

            <p className="pick-section">Minh văn</p>
            <div className="pick-grid">
              {data.inscriptions.map((inscription) => (
                <button
                  key={inscription.slug} className="pick"
                  aria-pressed={state.inscription === inscription.slug}
                  onClick={() => update((d) => { d.equip[position].inscription = inscription.slug; })}
                >
                  <img className="pick-icon" src={`/game/armament/${99 + inscription.art}.png`} alt="" />
                  <span className="pick-name">{inscription.nameVi}</span>
                  <span className="pick-sub">
                    {Object.entries(inscription.stats)
                      .map(([key, value]) => signed(value, statMeta(key)?.kind ?? "PERCENT"))
                      .join(" ")}
                  </span>
                </button>
              ))}
              <button
                className="pick" aria-pressed={!state.inscription}
                onClick={() => update((d) => { d.equip[position].inscription = null; })}
              >
                <span className="ghost-slot">✕</span>
                <span className="pick-name">Bỏ trống</span>
              </button>
            </div>
            <p className="panel-note">
              Biểu tượng minh văn đang mượn tạm ảnh vũ trang — thư mục <code>minh văn</code> trong
              bộ asset chứa <code>img_icon_Armament_*</code>, mà trong game đó là bảng
              <b> Chọn Vũ Trang</b>. Cần xác nhận đâu là ảnh minh văn thật.
            </p>
          </Modal>
        );
      })() : null}
    </div>
  );
}

function Modal({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="lab-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="lab-modal-backdrop" onClick={onClose} />
      <div className="lab-modal-box">
        <div className="lab-modal-head">
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="Đóng">✕</button>
        </div>
        <div className="lab-modal-body">{children}</div>
      </div>
    </div>
  );
}

function EquipmentDetail({ item, state, position, troop, statLabel, statMeta, onTier }: {
  item: LabData["equipment"][number];
  state: { tier: number };
  position: Position;
  troop: string | null;
  statLabel: (key: string) => string;
  statMeta: (key: string) => { kind: "FLAT" | "PERCENT" } | null;
  onTier: (tier: number) => void;
}) {
  const boosted = item.specialTalent != null && item.specialTalent.troopType === troop;
  const multiplier = boosted ? 1 + item.specialTalent!.bonusPercent / 100 : 1;
  const kindOf = (key: string) => statMeta(key)?.kind ?? "PERCENT";

  return (
    <>
      <div className="detail-head">
        <img src={`/game/equip/${position}.png`} alt="" />
        <div>
          <h3>{item.nameVi}</h3>
          <p>{POSITION_LABEL[position]} · {RARITY_VI[item.rarity] ?? item.rarity} · bậc {tierLabel(state.tier)}</p>
        </div>
      </div>
      <div className="tier-picker">
        {[1, 2, 3, 4, 5].map((tier) => (
          <button key={tier} aria-pressed={tier === state.tier} onClick={() => onTier(tier)}>
            {tierLabel(tier)}
          </button>
        ))}
      </div>

      <div className="detail-block">
        <h4>Thuộc tính trang bị</h4>
        {(item.baseStats ?? []).map((line) => {
          const value = (line.base + line.perTier * (state.tier - 1)) * multiplier;
          return (
            <div key={line.statKey} className="detail-line">
              <span className="n">{statLabel(line.statKey)}</span>
              <span className="v">
                {signed(value, kindOf(line.statKey))}
                <em>{signed(line.perTier * multiplier, kindOf(line.statKey))}</em>
              </span>
            </div>
          );
        })}
      </div>

      <div className="detail-block">
        <h4>Thuộc tính biểu trưng</h4>
        {(item.iconic ?? []).map((entry) => {
          const unlocked = state.tier >= entry.level;
          const numeric = typeof entry.statKey === "string" && typeof entry.base === "number";
          const value = numeric ? entry.base! + (entry.perTier ?? 0) * (state.tier - entry.level) : null;
          return (
            <div key={entry.level} className={`detail-line${unlocked ? "" : " off"}`}>
              <span className="n">
                <span className="roman">{tierLabel(entry.level)}</span>
                {numeric ? statLabel(entry.statKey!) : entry.nameVi}
                {entry.conditional ? <span className="cond-tag">có điều kiện</span> : null}
              </span>
              <span className="v">
                {unlocked && numeric && value != null ? (
                  <>
                    {signed(value, kindOf(entry.statKey!))}
                    {entry.perTier ? <em>{signed(entry.perTier, kindOf(entry.statKey!))}</em> : null}
                  </>
                ) : "—"}
              </span>
            </div>
          );
        })}
      </div>

      {item.specialTalent ? (
        <p className="panel-note">
          Tài năng đặc biệt ({TROOP_VI[item.specialTalent.troopType]}): +{item.specialTalent.bonusPercent}%
          cho khối trên.{" "}
          {boosted
            ? <b className="ok">Đang được cộng.</b>
            : `Chưa được cộng vì chỉ huy chính là ${troop ? TROOP_VI[troop] : "chưa chọn"}.`}
        </p>
      ) : null}
    </>
  );
}
