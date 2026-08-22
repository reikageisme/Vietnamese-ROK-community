/** Kiểm tra file dữ liệu trang bị trước khi cho vào cơ sở dữ liệu.
 *
 * Số liệu vào hệ thống bằng cách người chụp màn hình rồi có người gõ lại. Người
 * gõ lại sẽ gõ sai — nhầm bậc, nhầm tên chỉ số, thiếu một ô. Cửa duy nhất chặn
 * được là ở đây, TRƯỚC khi ghi vào bảng, vì sau khi ghi thì một con số sai trông
 * y hệt một con số đúng.
 *
 * Hàm thuần, không đọc đĩa, không đụng Prisma — để test được.
 */

export const EQUIPMENT_SLOTS = [
  "HELMET", "CHEST", "WEAPON", "GLOVES", "LEGS", "BOOTS", "ACCESSORY",
] as const;
export const EQUIPMENT_RARITIES = [
  "NORMAL", "ADVANCED", "ELITE", "EPIC", "LEGENDARY",
] as const;
export const VERIFICATIONS = ["UNVERIFIED", "SCREENSHOT", "CONFIRMED"] as const;

export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];
export type EquipmentRarity = (typeof EQUIPMENT_RARITIES)[number];
export type Verification = (typeof VERIFICATIONS)[number];

export type TierEntry = {
  tier: number;
  stats: Record<string, number>;
  materials?: Record<string, number> | null;
  powerValue?: number | null;
  verification?: Verification;
  /** Đường dẫn tương đối tới ảnh chụp làm bằng chứng. */
  evidence?: string | null;
  note?: string | null;
};

export type TalentEntry = {
  unlockTier: number;
  nameVi: string;
  nameEn?: string | null;
  descriptionVi?: string | null;
  conditional?: boolean;
  effect: { stats?: Record<string, number>; trigger?: string | null };
  verification?: Verification;
  evidence?: string | null;
};

export type EquipmentFile = {
  slug: string;
  nameVi: string;
  nameEn?: string | null;
  slot: string;
  rarity: string;
  setSlug?: string | null;
  patch: string;
  tiers: TierEntry[];
  talents?: TalentEntry[];
};

export type ValidationResult = { errors: string[]; warnings: string[] };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isPlainNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function checkStats(
  stats: Record<string, unknown>,
  knownKeys: Set<string>,
  where: string,
  out: ValidationResult,
): void {
  const entries = Object.entries(stats ?? {});
  if (entries.length === 0) out.warnings.push(`${where}: không có chỉ số nào.`);
  for (const [key, value] of entries) {
    if (!knownKeys.has(key)) {
      out.errors.push(`${where}: chỉ số "${key}" không có trong từ điển.`);
      continue;
    }
    if (!isPlainNumber(value)) {
      out.errors.push(`${where}: chỉ số "${key}" phải là số, đang là ${JSON.stringify(value)}.`);
    }
  }
}

/**
 * @param knownStatKeys khoá hợp lệ, lấy từ StatDefinition.
 * @param knownPatches phiên bản game đã khai báo; rỗng nghĩa là bỏ qua kiểm tra.
 */
export function validateEquipmentFile(
  file: EquipmentFile,
  knownStatKeys: Iterable<string>,
  knownPatches: Iterable<string> = [],
): ValidationResult {
  const out: ValidationResult = { errors: [], warnings: [] };
  const keys = new Set(knownStatKeys);
  const patches = new Set(knownPatches);
  const label = file?.slug ? `[${file.slug}]` : "[không có slug]";

  if (!file || typeof file !== "object") {
    return { errors: ["File không phải một đối tượng JSON."], warnings: [] };
  }
  if (!file.slug || !SLUG.test(file.slug)) {
    out.errors.push(`${label} slug phải viết thường, nối bằng dấu gạch ngang.`);
  }
  if (!file.nameVi?.trim()) out.errors.push(`${label} thiếu nameVi.`);
  if (!EQUIPMENT_SLOTS.includes(file.slot as EquipmentSlot)) {
    out.errors.push(`${label} slot "${file.slot}" không hợp lệ (${EQUIPMENT_SLOTS.join(", ")}).`);
  }
  if (!EQUIPMENT_RARITIES.includes(file.rarity as EquipmentRarity)) {
    out.errors.push(`${label} rarity "${file.rarity}" không hợp lệ.`);
  }
  if (!file.patch?.trim()) {
    out.errors.push(`${label} thiếu patch — mỗi con số phải biết mình thuộc phiên bản game nào.`);
  } else if (patches.size > 0 && !patches.has(file.patch)) {
    out.errors.push(`${label} patch "${file.patch}" chưa được khai báo.`);
  }

  const tiers = Array.isArray(file.tiers) ? file.tiers : [];
  if (tiers.length === 0) {
    out.errors.push(`${label} chưa có bậc nào.`);
  }

  const seenTiers = new Set<number>();
  for (const entry of tiers) {
    const where = `${label} bậc ${entry?.tier}`;
    if (!Number.isInteger(entry?.tier) || entry.tier < 1) {
      out.errors.push(`${label} có bậc không hợp lệ: ${JSON.stringify(entry?.tier)}.`);
      continue;
    }
    if (seenTiers.has(entry.tier)) {
      out.errors.push(`${label} bậc ${entry.tier} bị khai hai lần.`);
      continue;
    }
    seenTiers.add(entry.tier);

    checkStats(entry.stats ?? {}, keys, where, out);

    if (entry.powerValue != null && !isPlainNumber(entry.powerValue)) {
      out.errors.push(`${where}: powerValue phải là số.`);
    }
    const verification = entry.verification ?? "UNVERIFIED";
    if (!VERIFICATIONS.includes(verification)) {
      out.errors.push(`${where}: verification "${verification}" không hợp lệ.`);
    } else if (verification !== "UNVERIFIED" && !entry.evidence?.trim()) {
      // Khai là đã đối chiếu thì phải chỉ ra đối chiếu với cái gì. Không có
      // luật này thì "đã kiểm chứng" chỉ là một chữ ai cũng gõ được.
      out.errors.push(`${where}: đánh dấu ${verification} thì phải kèm đường dẫn ảnh evidence.`);
    }
  }

  const sorted = [...seenTiers].sort((a, b) => a - b);
  if (sorted.length > 0) {
    if (sorted[0] !== 1) out.warnings.push(`${label} bắt đầu từ bậc ${sorted[0]} chứ không phải 1.`);
    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index] !== sorted[index - 1] + 1) {
        out.warnings.push(`${label} nhảy cóc từ bậc ${sorted[index - 1]} sang ${sorted[index]}.`);
      }
    }
  }

  for (const talent of file.talents ?? []) {
    const where = `${label} talent "${talent?.nameVi ?? "?"}"`;
    if (!talent?.nameVi?.trim()) out.errors.push(`${label} có talent thiếu nameVi.`);
    if (!Number.isInteger(talent?.unlockTier)) {
      out.errors.push(`${where}: unlockTier phải là số nguyên.`);
    } else if (sorted.length > 0 && !seenTiers.has(talent.unlockTier)) {
      out.errors.push(`${where}: mở ở bậc ${talent.unlockTier} nhưng bậc đó chưa được khai.`);
    }
    if (talent?.effect?.stats) checkStats(talent.effect.stats, keys, where, out);
    if (talent?.conditional && !talent?.effect?.trigger?.trim()) {
      out.warnings.push(`${where}: có điều kiện nhưng chưa ghi rõ điều kiện là gì.`);
    }
  }

  return out;
}

/** Gộp kết quả của nhiều file, thêm kiểm tra trùng slug giữa các file. */
export function validateDataset(
  files: EquipmentFile[],
  knownStatKeys: Iterable<string>,
  knownPatches: Iterable<string> = [],
): ValidationResult {
  const out: ValidationResult = { errors: [], warnings: [] };
  const seen = new Map<string, number>();

  for (const file of files) {
    const result = validateEquipmentFile(file, knownStatKeys, knownPatches);
    out.errors.push(...result.errors);
    out.warnings.push(...result.warnings);
    if (file?.slug) seen.set(file.slug, (seen.get(file.slug) ?? 0) + 1);
  }
  for (const [slug, count] of seen) {
    if (count > 1) out.errors.push(`slug "${slug}" xuất hiện trong ${count} file.`);
  }
  return out;
}
