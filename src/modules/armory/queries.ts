import { prisma } from "@/lib/prisma";

/** Truy vấn dùng chung cho các trang kho trang bị.
 *
 * Tên hiển thị đi qua bảng I18nMessage/I18nTranslation như mọi thứ khác trong
 * dự án, nên phải nối thêm một tầng. Hàm `pick` ở đây gói phần đó lại.
 */

type Translation = { locale: string; value: string };

/** Lấy bản dịch theo ngôn ngữ, lùi về tiếng Anh rồi về khoá nếu chưa có. */
export function pick(translations: Translation[] | undefined, locale = "vi", fallback = ""): string {
  if (!translations?.length) return fallback;
  return (
    translations.find((item) => item.locale === locale)?.value ??
    translations.find((item) => item.locale === "en")?.value ??
    fallback
  );
}

const nameInclude = { include: { translations: { select: { locale: true, value: true } } } } as const;

export type ArmoryListItem = {
  slug: string;
  name: string;
  slot: string;
  rarity: string;
  setName: string | null;
  tierCount: number;
  maxTier: number;
  weakestVerification: string;
  topStats: { key: string; label: string; value: number; kind: "FLAT" | "PERCENT" }[];
};

const VERIFICATION_RANK = { UNVERIFIED: 0, SCREENSHOT: 1, CONFIRMED: 2 } as const;

export async function listEquipment(): Promise<ArmoryListItem[]> {
  const [rows, statDefs] = await Promise.all([
    prisma.equipment.findMany({
      orderBy: { slug: "asc" },
      include: {
        name: nameInclude,
        set: { include: { name: nameInclude } },
        tiers: { orderBy: { tier: "asc" } },
      },
    }),
    prisma.statDefinition.findMany({ include: { name: nameInclude } }),
  ]);

  const statLabel = new Map(statDefs.map((stat) => [stat.key, { label: pick(stat.name.translations, "vi", stat.key), kind: stat.kind }]));

  return rows.map((row) => {
    const tiers = row.tiers;
    const best = tiers.at(-1);
    const stats = (best?.stats ?? {}) as unknown as Record<string, number>;
    // Chỉ lấy ba chỉ số lớn nhất của bậc cao nhất — thẻ trong lưới không đủ chỗ
    // cho tất cả, và người xem lướt qua chỉ cần biết món này thiên về gì.
    const topStats = Object.entries(stats)
      .filter(([, value]) => typeof value === "number")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key, value]) => ({
        key,
        value,
        label: statLabel.get(key)?.label ?? key,
        kind: (statLabel.get(key)?.kind ?? "PERCENT") as "FLAT" | "PERCENT",
      }));

    const weakest = tiers.reduce<string>((worst, tier) => {
      const a = VERIFICATION_RANK[worst as keyof typeof VERIFICATION_RANK] ?? 0;
      const b = VERIFICATION_RANK[tier.verification as keyof typeof VERIFICATION_RANK] ?? 0;
      return b < a ? tier.verification : worst;
    }, "CONFIRMED");

    return {
      slug: row.slug,
      name: pick(row.name.translations, "vi", row.slug),
      slot: row.equipmentSlot ?? row.slot,
      rarity: row.rarity,
      setName: row.set ? pick(row.set.name.translations, "vi", row.set.slug) : null,
      tierCount: tiers.length,
      maxTier: best?.tier ?? 0,
      weakestVerification: tiers.length ? weakest : "UNVERIFIED",
      topStats,
    };
  });
}

export async function getEquipment(slug: string) {
  const [row, statDefs] = await Promise.all([
    prisma.equipment.findUnique({
      where: { slug },
      include: {
        name: nameInclude,
        set: { include: { name: nameInclude } },
        tiers: { orderBy: { tier: "asc" }, include: { patch: true } },
        talentDefs: {
          orderBy: { unlockTier: "asc" },
          include: { name: nameInclude, description: nameInclude },
        },
      },
    }),
    prisma.statDefinition.findMany({ orderBy: [{ group: "asc" }, { sortOrder: "asc" }], include: { name: nameInclude } }),
  ]);
  if (!row) return null;

  const defs = statDefs.map((stat) => ({
    key: stat.key,
    label: pick(stat.name.translations, "vi", stat.key),
    kind: stat.kind as "FLAT" | "PERCENT",
    group: stat.group,
  }));

  // Chỉ giữ những chỉ số món này thực sự có, giữ đúng thứ tự của từ điển.
  const used = new Set(row.tiers.flatMap((tier) => Object.keys((tier.stats ?? {}) as unknown as object)));
  const columns = defs.filter((def) => used.has(def.key));

  return {
    slug: row.slug,
    name: pick(row.name.translations, "vi", row.slug),
    slot: row.equipmentSlot ?? row.slot,
    rarity: row.rarity,
    setName: row.set ? pick(row.set.name.translations, "vi", row.set.slug) : null,
    columns,
    tiers: row.tiers.map((tier) => ({
      tier: tier.tier,
      stats: (tier.stats ?? {}) as unknown as Record<string, number>,
      powerValue: tier.powerValue,
      verification: tier.verification,
      patchVersion: tier.patch.version,
    })),
    talents: row.talentDefs.map((talent) => ({
      unlockTier: talent.unlockTier,
      name: pick(talent.name.translations, "vi", talent.nameKey),
      description: talent.description ? pick(talent.description.translations, "vi", "") : "",
      conditional: talent.conditional,
      trigger: ((talent.effect ?? {}) as unknown as { trigger?: string | null }).trigger ?? null,
      verification: talent.verification,
    })),
  };
}

export type EquipmentDetail = NonNullable<Awaited<ReturnType<typeof getEquipment>>>;
