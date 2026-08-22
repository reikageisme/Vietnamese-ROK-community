/** Đổ dữ liệu kho trang bị từ `content/armory` vào cơ sở dữ liệu.
 *
 *   npm run armory:import
 *
 * Idempotent: chạy lại không nhân đôi. Mọi thứ đi qua upsert theo khoá tự nhiên
 * (slug, version, equipmentId+tier+patch), nên chạy lại sau khi sửa một con số
 * là cập nhật đúng dòng đó chứ không tạo dòng mới.
 *
 * Trình này KHÔNG tự sửa dữ liệu sai. Kiểm tra thật nằm ở `npm test`
 * (src/modules/armory/dataset.data.test.ts) với đầy đủ luật. Ở đây chỉ chặn hai
 * lỗi chết người: chỉ số lạ và patch chưa khai — vì hai cái đó ghi vào rồi thì
 * sửa rất phiền.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ROOT = join(process.cwd(), "content", "armory");
const readJson = (...parts) => JSON.parse(readFileSync(join(ROOT, ...parts), "utf8"));

/** Tạo khoá i18n kèm bản dịch. Mọi tên hiển thị trong dự án đều đi đường này. */
async function message(key, vi, en) {
  await prisma.i18nMessage.upsert({ where: { key }, update: {}, create: { key } });
  for (const [locale, value] of [["vi", vi], ["en", en ?? vi]]) {
    if (!value) continue;
    await prisma.i18nTranslation.upsert({
      where: { messageId_locale: { messageId: key, locale } },
      update: { value },
      create: { messageId: key, locale, value },
    });
  }
  return key;
}

async function main() {
  const definitions = readJson("stat-definitions.json");
  const patchFile = readJson("patches.json");

  // --- phiên bản game ---
  const patchIds = new Map();
  for (const entry of patchFile.patches) {
    const titleKey = await message(`codex.patch.${entry.version}.title`, entry.titleVi, entry.titleEn);
    const patch = await prisma.patch.upsert({
      where: { version: entry.version },
      update: { titleKey, releasedAt: entry.releasedAt ? new Date(entry.releasedAt) : null },
      create: {
        version: entry.version,
        titleKey,
        releasedAt: entry.releasedAt ? new Date(entry.releasedAt) : null,
      },
    });
    patchIds.set(entry.version, patch.id);
  }
  console.log(`phiên bản game: ${patchIds.size}`);

  // --- từ điển chỉ số ---
  const statKeys = new Set();
  for (const stat of definitions.stats) {
    const nameKey = await message(`armory.stat.${stat.key}.name`, stat.vi, stat.en);
    await prisma.statDefinition.upsert({
      where: { key: stat.key },
      update: { kind: stat.kind, stackRule: stat.stackRule, group: stat.group, sortOrder: stat.sortOrder ?? 0, nameKey },
      create: {
        key: stat.key, nameKey, kind: stat.kind, stackRule: stat.stackRule,
        group: stat.group, sortOrder: stat.sortOrder ?? 0,
      },
    });
    statKeys.add(stat.key);
  }
  console.log(`chỉ số: ${statKeys.size}`);

  // --- trang bị ---
  const directory = join(ROOT, "equipment");
  if (!existsSync(directory)) { console.log("chưa có thư mục equipment, bỏ qua."); return; }
  const names = readdirSync(directory).filter((name) => name.endsWith(".json") && !name.startsWith("_"));
  if (names.length === 0) { console.log("chưa có file trang bị nào."); return; }

  let tierCount = 0;
  let talentCount = 0;

  for (const name of names) {
    const file = JSON.parse(readFileSync(join(directory, name), "utf8"));
    const patchId = patchIds.get(file.patch);
    if (!patchId) throw new Error(`${name}: patch "${file.patch}" chưa khai trong patches.json`);

    for (const tier of file.tiers ?? []) {
      for (const key of Object.keys(tier.stats ?? {})) {
        if (!statKeys.has(key)) throw new Error(`${name} bậc ${tier.tier}: chỉ số "${key}" không có trong từ điển`);
      }
    }

    const nameKey = await message(`codex.equipment.${file.slug}.name`, file.nameVi, file.nameEn);
    const setId = file.setSlug
      ? (await prisma.equipmentSet.findUnique({ where: { slug: file.setSlug } }))?.id ?? null
      : null;
    if (file.setSlug && !setId) console.warn(`  ! ${file.slug}: chưa có bộ "${file.setSlug}", tạm để trống`);

    const equipment = await prisma.equipment.upsert({
      where: { slug: file.slug },
      update: { rarity: file.rarity, slot: file.slot, equipmentSlot: file.slot, setId, nameKey },
      create: {
        slug: file.slug, nameKey, rarity: file.rarity, slot: file.slot,
        equipmentSlot: file.slot, setId, stats: {},
      },
    });

    for (const tier of file.tiers ?? []) {
      await prisma.equipmentTier.upsert({
        where: { equipmentId_tier_patchId: { equipmentId: equipment.id, tier: tier.tier, patchId } },
        update: {
          stats: tier.stats ?? {}, materials: tier.materials ?? null, powerValue: tier.powerValue ?? null,
          verification: tier.verification ?? "UNVERIFIED", evidenceKey: tier.evidence ?? null, note: tier.note ?? null,
        },
        create: {
          equipmentId: equipment.id, tier: tier.tier, patchId,
          stats: tier.stats ?? {}, materials: tier.materials ?? null, powerValue: tier.powerValue ?? null,
          verification: tier.verification ?? "UNVERIFIED", evidenceKey: tier.evidence ?? null, note: tier.note ?? null,
        },
      });
      tierCount += 1;
    }

    for (const talent of file.talents ?? []) {
      const talentNameKey = await message(
        `codex.equipment.${file.slug}.talent.${talent.unlockTier}.name`, talent.nameVi, talent.nameEn,
      );
      const descriptionKey = talent.descriptionVi
        ? await message(`codex.equipment.${file.slug}.talent.${talent.unlockTier}.description`, talent.descriptionVi, null)
        : null;
      const existing = await prisma.equipmentTalentDef.findUnique({ where: { nameKey: talentNameKey } });
      const payload = {
        equipmentId: equipment.id, unlockTier: talent.unlockTier, nameKey: talentNameKey, descriptionKey,
        effect: talent.effect ?? {}, conditional: Boolean(talent.conditional),
        verification: talent.verification ?? "UNVERIFIED", evidenceKey: talent.evidence ?? null,
      };
      if (existing) await prisma.equipmentTalentDef.update({ where: { id: existing.id }, data: payload });
      else await prisma.equipmentTalentDef.create({ data: payload });
      talentCount += 1;
    }

    console.log(`  ${file.slug}: ${file.tiers?.length ?? 0} bậc, ${file.talents?.length ?? 0} talent`);
  }

  console.log(`\nxong — ${names.length} món, ${tierCount} bậc, ${talentCount} talent`);
}

main()
  .catch((error) => { console.error("\nDỪNG:", error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
