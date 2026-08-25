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
