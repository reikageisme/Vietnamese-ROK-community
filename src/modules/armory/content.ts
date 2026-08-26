import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

import type { EquipmentFile } from "./dataset";
import { resolveEquipment, type EquipmentSource } from "./equipment-model";
import type { ArmoryListItem } from "./queries";

/** Đọc kho trang bị thẳng từ file trong `content/armory`.
 *
 * File JSON là nguồn sự thật, không phải cơ sở dữ liệu. Cơ sở dữ liệu là bản sao
 * do `scripts/import-armory.mjs` ghi vào, dùng cho những thứ cần truy vấn có cấu
 * trúc (build người dùng lưu, thống kê). Trang tra cứu thì không cần tới đó.
 *
 * Hệ quả trực tiếp: `git pull` xong là trang có dữ liệu ngay, không phải chạy
 * migration, không phải chờ import. Trước đây `/armory` trống rỗng chỉ vì bảng
 * chưa được tạo — một trang tra cứu tĩnh không đáng phải phụ thuộc vào đó.
 */

const ROOT = join(process.cwd(), "content", "armory");

export type StatDefinitionFile = {
  key: string;
  group: string;
  kind: "FLAT" | "PERCENT";
  stackRule: "ADDITIVE" | "MULTIPLICATIVE" | "MAX_ONLY";
  sortOrder: number;
  vi: string;
  en?: string;
};

type Cache = {
  stats: StatDefinitionFile[];
  statByKey: Map<string, StatDefinitionFile>;
  equipment: EquipmentFile[];
};

let cache: Cache | null = null;

function readJson<T>(...parts: string[]): T {
  return JSON.parse(readFileSync(join(ROOT, ...parts), "utf8")) as T;
}

function load(): Cache {
  // Trong chế độ phát triển, đọc lại mỗi lần để sửa file là thấy ngay.
  if (cache && process.env.NODE_ENV === "production") return cache;

  const stats = readJson<{ stats: StatDefinitionFile[] }>("stat-definitions.json").stats;

  const directory = join(ROOT, "equipment");
  const equipment: EquipmentFile[] = existsSync(directory)
    ? readdirSync(directory)
        .filter((name) => name.endsWith(".json") && !name.startsWith("_"))
        .map((name) => JSON.parse(readFileSync(join(directory, name), "utf8")) as EquipmentFile)
        .sort((a, b) => a.slug.localeCompare(b.slug))
    : [];

  cache = { stats, statByKey: new Map(stats.map((stat) => [stat.key, stat])), equipment };
  return cache;
}

export function statDefinitions(): StatDefinitionFile[] {
  return load().stats;
}

/** Nhãn và loại của một chỉ số. Khoá lạ thì trả về chính nó chứ không nuốt im lặng. */
export function statMeta(key: string): { label: string; kind: "FLAT" | "PERCENT"; group: string } {
  const found = load().statByKey.get(key);
  return found
    ? { label: found.vi, kind: found.kind, group: found.group }
    : { label: key, kind: "PERCENT", group: "unknown" };
}

export function allEquipment(): EquipmentFile[] {
  return load().equipment;
}

export function findEquipment(slug: string): EquipmentFile | null {
  return load().equipment.find((item) => item.slug === slug) ?? null;
}

/** Chuyển file dữ liệu sang dạng bộ dựng panel đọc được. */
export function toSource(file: EquipmentFile): EquipmentSource {
  return {
    slug: file.slug,
    nameVi: file.nameVi,
    nameEn: file.nameEn ?? null,
    slot: file.slot,
    rarity: file.rarity,
    equipmentLevel: file.equipmentLevel ?? null,
    seasonLimited: file.seasonLimited ?? false,
    maxTier: file.maxTier ?? 5,
    baseTier: file.baseTier ?? 1,
    baseStats: (file.baseStats ?? []).map((line) => ({
      statKey: line.statKey,
      base: line.base,
      perTier: line.perTier,
    })),
    iconic: (file.iconic ?? []).map((entry) => ({
      level: entry.level,
      statKey: entry.statKey ?? null,
      base: entry.base ?? null,
      perTier: entry.perTier ?? null,
      nameVi: entry.nameVi ?? null,
      nameEn: entry.nameEn ?? null,
      descriptionVi: entry.descriptionVi ?? null,
      conditional: entry.conditional ?? false,
    })),
    specialTalent: file.specialTalent
      ? {
          troopType: file.specialTalent.troopType as "infantry" | "cavalry" | "archer" | "siege",
          bonusPercent: file.specialTalent.bonusPercent,
          descriptionVi: file.specialTalent.descriptionVi ?? null,
        }
      : null,
  };
}

/** Món đồ này có phải dữ liệu mẫu để dựng giao diện hay không. */
export function isDemo(file: EquipmentFile): boolean {
  return file.slug.startsWith("demo-");
}

/** Danh sách cho trang lưới, dựng từ file — cùng hình dạng với bản lấy từ DB. */
export function listEquipmentFromContent(): ArmoryListItem[] {
  return allEquipment().map((file) => {
    const source = toSource(file);
    const maxTier = source.maxTier ?? 5;
    const top = resolveEquipment(source, { tier: maxTier });

    // Thẻ trong lưới chỉ đủ chỗ cho ba dòng; người lướt qua chỉ cần biết món này
    // thiên về gì, còn số đầy đủ nằm ở trang chi tiết.
    const topStats = top.baseStats
      .map((line) => {
        const meta = statMeta(line.statKey);
        return { key: line.statKey, value: line.value, label: meta.label, kind: meta.kind };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);

    return {
      slug: file.slug,
      name: file.nameVi,
      slot: file.slot,
      rarity: file.rarity,
      setName: null,
      tierCount: maxTier,
      maxTier,
      weakestVerification: file.verification ?? "UNVERIFIED",
      topStats,
    };
  });
}

/* ------------------------------------------------------------------ bàn thử */

import type {
  LabCommander, LabData, LabEquipment, LabFormation, LabInscription,
} from "./lab";
import type { StatDefinition, Verification } from "./types";
import type { TroopType } from "./equipment-model";

type CommanderIndexEntry = {
  slug: string; name: string; rarity: string | null; troop: string | null;
  art: string | null; skillArt: number[]; wakeupArt: number[];
};

/** Chỉ huy đến từ HAI nguồn, và thứ tự ưu tiên là cố ý:
 *
 *  1. `commanders-from-assets.json` — sinh ra từ cây thư mục đội phân loại.
 *     Có tên, độ hiếm, loại quân và id ảnh kỹ năng cho cả ~140 người.
 *  2. `commanders/<slug>.json` — người nhập liệu gõ tay: chỉ số, mô tả kỹ năng,
 *     năm mức nâng cấp. Mới có vài người.
 *
 * File gõ tay ĐÈ lên bản sinh tự động, vì nó là thứ có người đọc lại và xác
 * nhận. Ai chưa có file riêng thì vẫn hiện trong danh sách chọn, chỉ là chưa có
 * chỉ số — thà hiện ra là còn thiếu, còn hơn giấu người đó đi.
 */
function loadCommanders(): LabCommander[] {
  const index = existsSync(join(ROOT, "commanders-from-assets.json"))
    ? readJson<{ commanders: CommanderIndexEntry[] }>("commanders-from-assets.json").commanders
    : [];

  const detailDir = join(ROOT, "commanders");
  const details = new Map<string, Record<string, unknown>>();
  if (existsSync(detailDir)) {
    for (const name of readdirSync(detailDir)) {
      if (!name.endsWith(".json") || name.startsWith("_")) continue;
      const file = JSON.parse(readFileSync(join(detailDir, name), "utf8")) as Record<string, unknown>;
      if (typeof file.slug === "string") details.set(file.slug, file);
    }
  }

  const troopOf = (value: unknown): TroopType | null =>
    value === "infantry" || value === "cavalry" || value === "archer" || value === "siege"
      ? value : null;

  const merged: LabCommander[] = [];
  const seen = new Set<string>();

  const build = (base: Partial<CommanderIndexEntry>, detail?: Record<string, unknown>): LabCommander => {
    const slug = String(detail?.slug ?? base.slug);
    const skillArt = base.skillArt ?? [];
    const wakeupArt = base.wakeupArt ?? [];
    const fallbackSkills = [...skillArt.map(String), ...wakeupArt.map((n) => `wake-${n}`)]
      .map((art, index) => ({
        order: index + 1,
        name: index === skillArt.length ? "Tinh Thông" : `Kỹ năng ${index + 1}`,
        kind: index === skillArt.length ? "Tinh thông" : "Chưa nhập",
        art,
        text: "Chưa nhập mô tả cho kỹ năng này.",
        values: [] as string[][],
      }));

    return {
      slug,
      name: String(detail?.nameVi ?? base.name ?? slug),
      art: (detail?.art as string | undefined) ?? base.art ?? null,
      rarity: String(detail?.rarity ?? base.rarity ?? "ADVANCED"),
      troop: troopOf(detail?.troop ?? base.troop),
      troops: (detail?.troops as TroopType[] | undefined)
        ?? (troopOf(base.troop) ? [troopOf(base.troop) as TroopType] : []),
      roles: (detail?.roles as string[] | undefined) ?? [],
      maxStars: Number(detail?.maxStars ?? (base.rarity === "LEGENDARY" ? 6 : 5)),
      stats: (detail?.stats as Record<string, number> | undefined) ?? {},
      verification: (detail?.verification as Verification | undefined) ?? "UNVERIFIED",
      skills: (detail?.skills as LabCommander["skills"] | undefined) ?? fallbackSkills,
    };
  };

  for (const entry of index) {
    merged.push(build(entry, details.get(entry.slug)));
    seen.add(entry.slug);
  }
  for (const [slug, detail] of details) {
    if (!seen.has(slug)) merged.push(build({ slug }, detail));
  }

  merged.sort((a, b) =>
    Number(Boolean(b.stats && Object.keys(b.stats).length)) - Number(Boolean(a.stats && Object.keys(a.stats).length))
    || Number(Boolean(b.art)) - Number(Boolean(a.art))
    || a.name.localeCompare(b.name, "vi"));
  return merged;
}

function readList<T>(file: string, key: string): T[] {
  if (!existsSync(join(ROOT, file))) return [];
  return (readJson<Record<string, T[]>>(file)[key] ?? []) as T[];
}

/** Toàn bộ dữ liệu bàn thử, gói một lần cho trang server truyền xuống client. */
export function labData(): LabData {
  const statDefinitions: StatDefinition[] = statDefinitions_();
  return {
    statDefinitions,
    statLabels: Object.fromEntries(statDefinitions_labels()),
    commanders: loadCommanders(),
    equipment: allEquipment().map((file): LabEquipment => ({
      ...toSource(file),
      nameVi: file.nameVi,
      art: (file as { art?: string }).art ?? null,
      verification: (file.verification ?? "UNVERIFIED") as Verification,
    })),
    inscriptions: readList<LabInscription>("inscriptions.json", "inscriptions"),
    formations: readList<LabFormation>("formations.json", "formations"),
  };
}

function statDefinitions_(): StatDefinition[] {
  return statDefinitions().map((stat) => ({
    key: stat.key, kind: stat.kind, stackRule: stat.stackRule,
    group: stat.group, sortOrder: stat.sortOrder,
  }));
}

function statDefinitions_labels(): [string, string][] {
  return statDefinitions().map((stat) => [stat.key, stat.vi]);
}
