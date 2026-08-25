/** Dịch bảng trang bị trong game sang dữ liệu máy đọc được.
 *
 * Panel trang bị của Rise of Kingdoms không cho một bảng năm bậc. Nó cho HAI con
 * số cho mỗi dòng: giá trị hiện tại, và một số màu xanh là mức tăng mỗi lần nâng
 * bậc — "Phòng thủ bộ binh +12% (+4%)". Người nhập liệu vì thế chỉ phải gõ hai
 * số cho mỗi dòng thay vì năm; module này suy ra phần còn lại.
 *
 * Đó không phải chuyện tiện tay. Gõ hai số thay vì năm là bớt 60% chỗ gõ sai, và
 * một số sai trong bảng chỉ số trông y hệt một số đúng.
 *
 * Panel còn có hai khối tách bạch mà mô hình cũ gộp làm một:
 *
 *   Thuộc Tính Trang Bị   — chỉ số nền, có ngay từ bậc I.
 *   Thuộc Tính Biểu Trưng — danh sách I–V, mỗi bậc mở thêm MỘT dòng, và bậc V
 *                           luôn là một hiệu ứng có tên kèm lời mô tả chứ không
 *                           phải một con số.
 *
 * Gộp hai khối lại là sai về hiển thị (người chơi tra theo đúng thứ tự đó) và
 * sai về tính toán (dòng biểu trưng chưa mở thì chưa được cộng).
 *
 * Hàm thuần: không đọc đĩa, không đụng Prisma.
 */

export type TroopType = "infantry" | "cavalry" | "archer" | "siege";

export const TROOP_TYPES: TroopType[] = ["infantry", "cavalry", "archer", "siege"];

/** Một dòng chỉ số kiểu "giá trị nền + mức tăng mỗi bậc". */
export type GrowthLine = {
  statKey: string;
  /** Giá trị tại bậc `baseTier` của món đồ. */
  base: number;
  /** Số màu xanh trong game: cộng thêm bấy nhiêu mỗi lần nâng một bậc. */
  perTier: number;
};

/** Một mục trong khối Thuộc Tính Biểu Trưng. Bậc I–IV là số, bậc V là hiệu ứng. */
export type IconicEntry = {
  /** 1..maxTier. Hiển thị bằng chữ số La Mã. */
  level: number;
  statKey?: string | null;
  base?: number | null;
  perTier?: number | null;
  nameVi?: string | null;
  nameEn?: string | null;
  descriptionVi?: string | null;
  /** Chỉ có hiệu lực khi thoả điều kiện — không bao giờ được cộng vào chỉ số nền. */
  conditional?: boolean;
  effect?: { stats?: Record<string, number> | null; trigger?: string | null } | null;
};

/** "Khi được trang bị bởi một chỉ huy có Bộ binh tài năng, thuộc tính này tăng 30%." */
export type SpecialTalent = {
  troopType: TroopType;
  bonusPercent: number;
  descriptionVi?: string | null;
};

export type EquipmentSource = {
  slug: string;
  nameVi: string;
  nameEn?: string | null;
  slot: string;
  rarity: string;
  /** "Cấp độ trang bị 45" ở đầu panel. Không phải bậc. */
  equipmentLevel?: number | null;
  /** "Trang bị giới hạn cho Mùa Chinh Phạt". */
  seasonLimited?: boolean;
  /** Số bậc món này có. Là dữ liệu vì game có thể thêm bậc. */
  maxTier?: number;
  /** Bậc mà các con số `base` được đọc ra. Mặc định I. */
  baseTier?: number;
  /** Khối "Thuộc Tính Trang Bị". */
  baseStats?: GrowthLine[];
  /** Khối "Thuộc Tính Biểu Trưng", thứ tự I–V. */
  iconic?: IconicEntry[];
  specialTalent?: SpecialTalent | null;
};

export type ResolvedStatLine = {
  statKey: string;
  /** Giá trị ở bậc đang xem, đã tính tài năng đặc biệt nếu có bật. */
  value: number;
  /** Giá trị khi chưa nhân tài năng đặc biệt. */
  rawValue: number;
  perTier: number;
  /** Chênh so với bậc liền trước — lý do người chơi mở trang này ra. */
  delta: number;
  boostedBySpecialTalent: boolean;
};

export type ResolvedIconic = {
  level: number;
  unlocked: boolean;
  statKey?: string | null;
  /** Chỉ có khi đã mở và mục này là một dòng số. */
  value?: number | null;
  perTier?: number | null;
  delta?: number | null;
  nameVi?: string | null;
  nameEn?: string | null;
  descriptionVi?: string | null;
  conditional: boolean;
};

export type ResolvedEquipment = {
  slug: string;
  tier: number;
  maxTier: number;
  baseStats: ResolvedStatLine[];
  iconic: ResolvedIconic[];
  specialTalent: SpecialTalent | null;
  /** Tài năng đặc biệt có đang được tính hay không, và vì sao. */
  specialTalentActive: boolean;
  warnings: string[];
};

export type ResolveOptions = {
  tier: number;
  /** Loại quân mà tài năng chỉ huy đang thiên về. Null = không rõ, không cộng. */
  commanderTroopType?: TroopType | null;
};

const round = (value: number): number => Math.round(value * 1000) / 1000;

/** Giá trị của một dòng ở bậc bất kỳ. */
export function valueAtTier(line: GrowthLine, tier: number, baseTier = 1): number {
  return round(line.base + line.perTier * (tier - baseTier));
}

/**
 * Dựng lại panel trang bị ở một bậc cụ thể.
 *
 * Tài năng đặc biệt chỉ nhân vào khối Thuộc Tính Trang Bị. Câu trong game
 * ("thiết bị thuộc tính này được tăng 30%") không nói rõ có nhân cả khối biểu
 * trưng hay không, nên ở đây KHÔNG nhân, và trả về một cảnh báo nói đúng điều
 * đó. Đoán rộng ra sẽ làm mọi con số cao hơn thực tế mà không ai biết.
 */
export function resolveEquipment(
  source: EquipmentSource,
  options: ResolveOptions,
): ResolvedEquipment {
  const warnings: string[] = [];
  const maxTier = source.maxTier ?? 5;
  const baseTier = source.baseTier ?? 1;

  let tier = Math.trunc(options.tier);
  if (!Number.isFinite(tier)) tier = baseTier;
  if (tier < 1) {
    warnings.push(`Bậc ${options.tier} nhỏ hơn I, đã lấy bậc I.`);
    tier = 1;
  }
  if (tier > maxTier) {
    warnings.push(`Bậc ${options.tier} vượt bậc cao nhất (${maxTier}), đã lấy bậc ${maxTier}.`);
    tier = maxTier;
  }

  const talent = source.specialTalent ?? null;
  const specialTalentActive =
    talent != null && options.commanderTroopType === talent.troopType;
  if (talent != null && options.commanderTroopType == null) {
    warnings.push(
      `Món này có tài năng đặc biệt (${talent.troopType} +${talent.bonusPercent}%) nhưng chưa chọn chỉ huy, nên chưa cộng.`,
    );
  }
  const multiplier = specialTalentActive ? 1 + talent!.bonusPercent / 100 : 1;

  const baseStats: ResolvedStatLine[] = (source.baseStats ?? []).map((line) => {
    const raw = valueAtTier(line, tier, baseTier);
    const previous = tier > 1 ? valueAtTier(line, tier - 1, baseTier) : 0;
    return {
      statKey: line.statKey,
      rawValue: raw,
      value: round(raw * multiplier),
      perTier: line.perTier,
      delta: round((raw - previous) * multiplier),
      boostedBySpecialTalent: specialTalentActive,
    };
  });

  const iconic: ResolvedIconic[] = [...(source.iconic ?? [])]
    .sort((a, b) => a.level - b.level)
    .map((entry) => {
      const unlocked = tier >= entry.level;
      const isNumeric = typeof entry.statKey === "string" && typeof entry.base === "number";

      if (!isNumeric) {
        return {
          level: entry.level,
          unlocked,
          nameVi: entry.nameVi ?? null,
          nameEn: entry.nameEn ?? null,
          descriptionVi: entry.descriptionVi ?? null,
          conditional: entry.conditional ?? false,
        };
      }

      // Dòng biểu trưng bắt đầu đếm từ chính bậc mở ra nó, không phải bậc I.
      const line: GrowthLine = {
        statKey: entry.statKey!,
        base: entry.base!,
        perTier: entry.perTier ?? 0,
      };
      const value = unlocked ? valueAtTier(line, tier, entry.level) : null;
      const previous =
        unlocked && tier > entry.level ? valueAtTier(line, tier - 1, entry.level) : 0;

      return {
        level: entry.level,
        unlocked,
        statKey: line.statKey,
        value,
        perTier: line.perTier,
        delta: unlocked ? round((value ?? 0) - previous) : null,
        nameVi: entry.nameVi ?? null,
        nameEn: entry.nameEn ?? null,
        descriptionVi: entry.descriptionVi ?? null,
        conditional: entry.conditional ?? false,
      };
    });

  if (specialTalentActive) {
    warnings.push(
      "Tài năng đặc biệt chỉ được nhân vào khối Thuộc Tính Trang Bị. Chưa xác nhận nó có nhân vào khối Biểu Trưng hay không.",
    );
  }
  if ((source.baseStats ?? []).length === 0 && (source.iconic ?? []).length === 0) {
    warnings.push("Món này chưa có dòng chỉ số nào.");
  }

  return {
    slug: source.slug,
    tier,
    maxTier,
    baseStats,
    iconic,
    specialTalent: talent,
    specialTalentActive,
    warnings,
  };
}

/** Toàn bộ bậc I..maxTier, để dựng bảng so sánh nâng bậc. */
export function resolveAllTiers(
  source: EquipmentSource,
  options: Omit<ResolveOptions, "tier"> = {},
): ResolvedEquipment[] {
  const maxTier = source.maxTier ?? 5;
  const out: ResolvedEquipment[] = [];
  for (let tier = 1; tier <= maxTier; tier += 1) {
    out.push(resolveEquipment(source, { ...options, tier }));
  }
  return out;
}

/**
 * Chuyển panel đã dựng thành các dòng đóng góp cho bộ tính chỉ số.
 *
 * Mục biểu trưng chưa mở thì không góp gì. Mục có điều kiện được đánh dấu
 * `conditional` để bộ tính tách ra khỏi tổng luôn-có-hiệu-lực.
 */
export function toContributions(
  resolved: ResolvedEquipment,
  meta: { label: string; verification: "UNVERIFIED" | "SCREENSHOT" | "CONFIRMED" },
): Array<{
  statKey: string;
  value: number;
  source: {
    kind: "EQUIPMENT" | "EQUIPMENT_TALENT";
    id: string;
    label: string;
    verification: "UNVERIFIED" | "SCREENSHOT" | "CONFIRMED";
    conditional?: boolean;
  };
}> {
  const out = [];

  for (const line of resolved.baseStats) {
    out.push({
      statKey: line.statKey,
      value: line.value,
      source: {
        kind: "EQUIPMENT" as const,
        id: resolved.slug,
        label: meta.label,
        verification: meta.verification,
      },
    });
  }

  for (const entry of resolved.iconic) {
    if (!entry.unlocked) continue;
    if (typeof entry.statKey !== "string" || typeof entry.value !== "number") continue;
    out.push({
      statKey: entry.statKey,
      value: entry.value,
      source: {
        kind: "EQUIPMENT_TALENT" as const,
        id: `${resolved.slug}#iconic-${entry.level}`,
        label: `${meta.label} · biểu trưng ${entry.level}`,
        verification: meta.verification,
        conditional: entry.conditional,
      },
    });
  }

  return out;
}
