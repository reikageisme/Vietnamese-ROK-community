#!/usr/bin/env node
/** Đọc cách đội phân loại thư mục chỉ huy, xuất ra `content/armory/commanders-from-assets.json`.
 *
 * Đội đang sắp xếp `game-assets/.../chi tiết từng tướng/` theo cây:
 *
 *   <độ hiếm>/<tên chỉ huy>/img_HeroSkill<n>.png
 *   <độ hiếm>/<loại quân>/<tên chỉ huy>/img_HeroSkill<n>.png
 *
 * Chính cái cây đó đã là dữ liệu: tên chỉ huy, độ hiếm, loại quân, và bốn ảnh
 * kỹ năng của từng người. Đọc lại thay vì bắt ai đó gõ lại — gõ lại là chỗ sinh
 * ra sai sót, mà một cái tên gắn sai ảnh thì không ai phát hiện được nữa.
 *
 * Script KHÔNG đoán id ảnh chân dung. Thư mục không nói ảnh nào là ai, nên cột
 * đó để trống cho người điền, trừ khi thư mục có sẵn ảnh chân dung bên trong.
 *
 *   node scripts/scan-commander-folders.mjs
 */

import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "game-assets");
const OUT = join(ROOT, "content", "armory", "commanders-from-assets.json");

const RARITY = { "tướng vàng":"LEGENDARY", "tướng tím":"EPIC",
                 "tướng xanh nước biển":"ELITE", "tướng xanh lá":"ADVANCED" };
const TROOP = { "bo binh":"infantry", "bộ binh":"infantry", "ky binh":"cavalry", "kỵ binh":"cavalry",
                "cung thu":"archer", "cung thủ":"archer", "cong trinh":"siege", "công trình":"siege",
                "lãnh đạo":"leadership", "lanh dao":"leadership", "kết hợp":"integration", "ket hop":"integration" };

/** Bỏ đuôi "done"/"DONE" đội gắn để tự đánh dấu tiến độ. */
const clean = (name) => name.replace(/\s*[-–]?\s*\b(done)\b\s*$/i, "").trim().replace(/\s{2,}/g, " ");
const norm = (name) => clean(name).toLowerCase();

function slugify(name) {
  return clean(name).normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Viết hoa đầu mỗi từ để hiển thị. Slug giữ nguyên — slug là khoá. */
const title = (name) => clean(name).split(/\s+/)
  .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1)))
  .join(" ");

function findRoots(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    let info;
    try { info = statSync(path); } catch { continue; }
    if (!info.isDirectory()) continue;
    if (norm(entry).includes("chi tiết từng tướng")) out.push(path);
    else findRoots(path, out);
  }
  return out;
}

if (!existsSync(SRC)) {
  console.error(`Không thấy ${SRC} — thư mục này không nằm trong git, bỏ qua.`);
  process.exit(0);
}
const roots = findRoots(SRC);
if (!roots.length) {
  console.error('Không thấy thư mục "chi tiết từng tướng" nào trong game-assets.');
  process.exit(1);
}

const rows = [];
const warnings = [];

function readCommander(dir, rarity, troop) {
  const skillArt = [], wakeupArt = [];
  let portraitArt = null;
  for (const entry of readdirSync(dir)) {
    const found = /img_(WakeUp)?HeroSkill(\d+)\.png$/i.exec(entry);
    if (found) { (found[1] ? wakeupArt : skillArt).push(Number(found[2])); continue; }
    const portrait = /img_icon_HeroProfile_(\d+[a-zA-Z]*)\.png$/i.exec(entry);
    if (portrait) portraitArt = portrait[1];
  }
  const name = clean(basename(dir));
  if (!skillArt.length && !portraitArt) return;
  rows.push({
    slug: slugify(name), name: title(name), rarity, troop,
    art: portraitArt,
    skillArt: skillArt.sort((a, b) => a - b),
    wakeupArt: wakeupArt.sort((a, b) => a - b),
  });
  if (skillArt.length && skillArt.length !== 4) {
    warnings.push(`${name}: có ${skillArt.length} ảnh kỹ năng, thường là 4.`);
  }
}

for (const root of roots) {
  for (const rarityDir of readdirSync(root)) {
    const rarityPath = join(root, rarityDir);
    if (!statSync(rarityPath).isDirectory()) continue;
    const rarity = RARITY[norm(rarityDir)] ?? null;
    if (!rarity) warnings.push(`Không nhận ra độ hiếm từ thư mục "${rarityDir}".`);

    for (const child of readdirSync(rarityPath)) {
      const childPath = join(rarityPath, child);
      if (!statSync(childPath).isDirectory()) continue;
      const troop = TROOP[norm(child)] ?? null;
      // Một tầng nữa là thư mục loại quân; không thì đây đã là chỉ huy.
      const hasSubDirs = readdirSync(childPath)
        .some((e) => { try { return statSync(join(childPath, e)).isDirectory(); } catch { return false; } });
      if (troop && hasSubDirs) {
        for (const leaf of readdirSync(childPath)) {
          const leafPath = join(childPath, leaf);
          if (statSync(leafPath).isDirectory()) readCommander(leafPath, rarity, troop);
        }
      } else {
        readCommander(childPath, rarity, troop);
      }
    }
  }
}

// Trùng slug thì GIỮ CẢ HAI. Rise of Kingdoms có nhiều chỉ huy hai bản
// (bản thường và bản thức tỉnh) trùng tên, nên bỏ bớt một là mất dữ liệu thật.
// Thêm hậu tố và báo ra để người sắp thư mục đặt lại tên cho rõ.
const bySlug = new Map();
for (const row of rows) {
  if (!bySlug.has(row.slug)) { bySlug.set(row.slug, row); continue; }
  const first = bySlug.get(row.slug);
  let n = 2;
  while (bySlug.has(`${row.slug}-${n}`)) n += 1;
  const unique = `${row.slug}-${n}`;
  warnings.push(
    `Hai thư mục cùng tên "${row.name}" (${first.rarity} và ${row.rarity}); ` +
    `bản thứ hai tạm mang slug "${unique}". Đặt lại tên thư mục cho rõ rồi chạy lại.`,
  );
  bySlug.set(unique, { ...row, slug: unique });
}
const list = [...bySlug.values()].sort((a, b) =>
  (a.rarity ?? "").localeCompare(b.rarity ?? "") || (a.troop ?? "").localeCompare(b.troop ?? "") ||
  a.slug.localeCompare(b.slug));

mkdirSync(join(OUT, ".."), { recursive: true });
writeFileSync(OUT, JSON.stringify({
  _ghi_chu: "Sinh ra từ scripts/scan-commander-folders.mjs — đừng sửa tay, chạy lại script.",
  _con_thieu: "Trường `art` là id ảnh chân dung; null nghĩa là thư mục chưa có ảnh chân dung bên trong.",
  commanders: list,
}, null, 2) + "\n", "utf8");

const withArt = list.filter((r) => r.art).length;
console.log(`${list.length} chỉ huy · ${withArt} đã có ảnh chân dung · ${list.length - withArt} chưa`);
const byRarity = {};
for (const r of list) byRarity[r.rarity ?? "?"] = (byRarity[r.rarity ?? "?"] ?? 0) + 1;
console.log(byRarity);
if (warnings.length) {
  console.warn(`\n${warnings.length} cảnh báo:`);
  for (const w of warnings.slice(0, 12)) console.warn("  · " + w);
  if (warnings.length > 12) console.warn(`  ... và ${warnings.length - 12} cảnh báo nữa`);
}
