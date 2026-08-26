/** Bàn thử build: gom mọi thứ người dùng lắp vào thành một bảng chỉ số.
 *
 * Không có engine riêng. Nó dựng danh sách đóng góp rồi đưa cho `aggregate()` —
 * cùng hàm mà mọi chỗ khác dùng. Hai engine tính chỉ số song song là cách chắc
 * chắn nhất để hai trang cùng một build hiện hai con số khác nhau.
 *
 * Hàm thuần: không đọc đĩa, không đụng Prisma, không biết React.
 */

import { resolveEquipment, type EquipmentSource, type TroopType } from "./equipment-model";
import { aggregate } from "./stats";
import type { Contribution, StatDefinition, StatSheet, Verification } from "./types";

/** Tám vị trí trên giao diện. Hai ô phụ kiện dùng chung loại ô `ACCESSORY`,
 *  đúng như game — nên đây là VỊ TRÍ, không phải loại ô. */
export const POSITIONS = [
  "helmet", "chest", "weapon", "gloves", "legs", "acc1", "acc2", "boots",
] as const;
export type Position = (typeof POSITIONS)[number];

/** Vị trí nào nhận loại ô nào. */
export const POSITION_SLOT: Record<Position, string> = {
  helmet: "HELMET", chest: "CHEST", weapon: "WEAPON", gloves: "GLOVES",
  legs: "LEGS", acc1: "ACCESSORY", acc2: "ACCESSORY", boots: "BOOTS",
};

export const POSITION_LABEL: Record<Position, string> = {
  helmet: "Mũ", chest: "Ngực", weapon: "Vũ khí", gloves: "Găng tay",
  legs: "Chân", acc1: "Phụ kiện 1", acc2: "Phụ kiện 2", boots: "Giày",
};

export type LabCommander = {
  slug: string;
  name: string;
  art: string | null;
  rarity: string;
  troop: TroopType | null;
  troops: TroopType[];
  roles: string[];
  maxStars: number;
  stats: Record<string, number>;
  verification: Verification;
  skills: {
    order: number; name: string; kind: string; art: string | null;
    text: string; values: string[][];
  }[];
};

export type LabEquipment = EquipmentSource & {
  nameVi: string;
  art: string | null;
  verification: Verification;
};

export type LabInscription = {
  slug: string; nameVi: string; art: number; stats: Record<string, number>;
};

export type LabFormation = {
  slug: string; nameVi: string; troop: string; art: number; stats: Record<string, number>;
};

export type LabData = {
  statDefinitions: StatDefinition[];
  /** Khoá chỉ số → tên tiếng Việt. Giao diện không tự đoán tên. */
  statLabels: Record<string, string>;
  commanders: LabCommander[];
  equipment: LabEquipment[];
  inscriptions: LabInscription[];
  formations: LabFormation[];
};

export type SlotState = { slug: string | null; tier: number; inscription: string | null };

export type Loadout = {
  primary: string | null;
  secondary: string | null;
  equip: Record<Position, SlotState>;
  formation: string | null;
};

export function emptyLoadout(): Loadout {
  return {
    primary: null, secondary: null, formation: null,
    equip: Object.fromEntries(
      POSITIONS.map((p) => [p, { slug: null, tier: 5, inscription: null }]),
    ) as Record<Position, SlotState>,
  };
}

/** Chỉ huy phụ chỉ góp một nửa chỉ số.
 *
 * Rise of Kingdoms không công bố con số này; cộng đồng suy ra từ thử nghiệm.
 * Để thành hằng số có tên ở đây để sửa một chỗ, chứ không rải 0.5 khắp code. */
export const SECONDARY_SCALE = 0.5;

const push = (
  out: Contribution[], statKey: string, value: number,
  source: Contribution["source"],
): void => {
  if (!value) return;
  out.push({ statKey, value, source });
};

/** Dựng bảng chỉ số cho một cấu hình. */
export function computeSheet(data: LabData, loadout: Loadout): StatSheet {
  const contributions: Contribution[] = [];
  const commander = (slug: string | null) =>
    slug ? data.commanders.find((c) => c.slug === slug) ?? null : null;

  const primary = commander(loadout.primary);
  const secondary = commander(loadout.secondary);

  for (const [role, c] of [["primary", primary], ["secondary", secondary]] as const) {
    if (!c) continue;
    const scale = role === "primary" ? 1 : SECONDARY_SCALE;
    for (const [statKey, value] of Object.entries(c.stats)) {
      push(contributions, statKey, value * scale, {
        kind: "COMMANDER_TALENT",
        id: `${c.slug}#${role}`,
        label: role === "primary" ? `${c.name} · chính` : `${c.name} · phụ (nửa hiệu lực)`,
        verification: c.verification,
      });
    }
  }

  for (const position of POSITIONS) {
    const state = loadout.equip[position];
    const item = state.slug ? data.equipment.find((e) => e.slug === state.slug) : null;
    if (item) {
      const resolved = resolveEquipment(item, {
        tier: state.tier,
        commanderTroopType: primary?.troop ?? null,
      });
      const boosted = resolved.specialTalentActive;
      const label = `${item.nameVi} · bậc ${state.tier}${boosted ? " (+" + item.specialTalent!.bonusPercent + "% tài năng đặc biệt)" : ""}`;

      for (const line of resolved.baseStats) {
        push(contributions, line.statKey, line.value, {
          kind: "EQUIPMENT", id: `${item.slug}#${position}`, label,
          verification: item.verification,
        });
      }
      for (const entry of resolved.iconic) {
        if (!entry.unlocked || typeof entry.statKey !== "string" || typeof entry.value !== "number") continue;
        push(contributions, entry.statKey, entry.value, {
          kind: "EQUIPMENT_TALENT",
          id: `${item.slug}#${position}#iconic-${entry.level}`,
          label: `${item.nameVi} · biểu trưng ${entry.level}`,
          verification: item.verification,
          conditional: entry.conditional,
        });
      }
    }

    const inscription = state.inscription
      ? data.inscriptions.find((i) => i.slug === state.inscription)
      : null;
    if (inscription) {
      for (const [statKey, value] of Object.entries(inscription.stats)) {
        push(contributions, statKey, value, {
          kind: "INSCRIPTION", id: `${inscription.slug}#${position}`,
          label: `${inscription.nameVi} · minh văn`, verification: "UNVERIFIED",
        });
      }
    }
  }

  const formation = loadout.formation
    ? data.formations.find((f) => f.slug === loadout.formation)
    : null;
  if (formation) {
    for (const [statKey, value] of Object.entries(formation.stats)) {
      push(contributions, statKey, value, {
        kind: "OTHER", id: formation.slug,
        label: `${formation.nameVi} · đội hình`, verification: "UNVERIFIED",
      });
    }
  }

  return aggregate(data.statDefinitions, contributions);
}

/** Điền số vào khuôn mô tả kỹ năng theo cấp đang chọn.
 *
 * Nâng một kỹ năng lên cấp là MỌI con số trong câu mô tả đổi theo — nên mô tả
 * là một khuôn có chỗ trống `{1}`, `{2}`, và mỗi chỗ trống có một dãy giá trị.
 * Trả về mảng đoạn để tầng hiển thị tự quyết định tô đậm thế nào, thay vì nhét
 * HTML vào đây.
 */
export function skillSegments(
  skill: { text: string; values: string[][] },
  level: number,
): { text: string; isValue: boolean }[] {
  const out: { text: string; isValue: boolean }[] = [];
  const pattern = /\{(\d+)\}/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(skill.text)) !== null) {
    if (match.index > last) out.push({ text: skill.text.slice(last, match.index), isValue: false });
    const series = skill.values[Number(match[1]) - 1];
    // Thiếu dãy giá trị thì giữ nguyên chỗ trống, không nuốt im lặng — người
    // nhập liệu phải thấy được là mình quên một cột.
    if (!series || series.length === 0) out.push({ text: match[0], isValue: false });
    else out.push({ text: series[Math.min(Math.max(level, 1), series.length) - 1], isValue: true });
    last = match.index + match[0].length;
  }
  if (last < skill.text.length) out.push({ text: skill.text.slice(last), isValue: false });
  return out;
}

/** Ước lượng sức mạnh để có một con số duy nhất so sánh nhanh giữa hai build.
 *
 * KHÔNG phải chỉ số power trong game — game không công bố công thức. Đây là một
 * thang quy ước của trang, và giao diện phải nói rõ như vậy.
 */
export function estimatePower(sheet: StatSheet): number {
  return Math.round(
    sheet.lines.reduce(
      (total, line) => total + Math.abs(line.total) * (line.kind === "PERCENT" ? 260 : 12),
      0,
    ),
  );
}
