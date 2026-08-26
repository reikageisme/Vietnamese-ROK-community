#!/usr/bin/env node
/** Chép biểu tượng cần dùng từ `game-assets/` sang `public/game/`.
 *
 * `game-assets/` là bản rút ra từ bản cài game trên máy, nằm trong .gitignore.
 * Repo chỉ mang theo đúng những file trang web thật sự hiển thị.
 *
 * Script này TÌM THEO TÊN FILE, không theo đường dẫn. Đội phân loại sắp xếp lại
 * thư mục là chuyện thường xuyên — bản trước hard-code `game-assets/all/` và đã
 * chết ngay lần sắp xếp đầu tiên. Tên file thì game đặt, không ai đổi.
 *
 * Không ghép sẵn khung độ hiếm vào ảnh chân dung: game xếp một nền khung dưới
 * một ảnh chân dung nền trong suốt, nên 160 chỉ huy cần 160 file chứ không phải
 * 160 × 4 khung.
 *
 *   node scripts/pick-game-assets.mjs              # khung, loại quân, trang bị, vũ trang, đội hình
 *   node scripts/pick-game-assets.mjs --portraits  # thêm toàn bộ chân dung chỉ huy
 *   node scripts/pick-game-assets.mjs --skills     # thêm toàn bộ biểu tượng kỹ năng
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "game-assets");
const OUT = join(ROOT, "public", "game");

if (!existsSync(SRC)) {
  console.error(`Không thấy ${SRC} — thư mục này rút ra từ bản cài game và không nằm trong git.`);
  process.exit(0);
}

/** Duyệt toàn bộ cây, lập chỉ mục theo TÊN FILE. */
function index(dir, into = new Map()) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    let info;
    try { info = statSync(path); } catch { continue; }
    if (info.isDirectory()) { index(path, into); continue; }
    if (!entry.toLowerCase().endsWith(".png")) continue;
    // Trùng tên ở hai thư mục thì giữ bản đầu và ghi lại, để còn biết mà kiểm.
    if (into.has(entry)) into.get(entry).duplicates.push(path);
    else into.set(entry, { path, duplicates: [] });
  }
  return into;
}

const files = index(SRC);
console.log(`chỉ mục ${files.size} file trong game-assets`);

const MAP = [
  // Khung độ hiếm — xếp DƯỚI ảnh chân dung; viền xếp TRÊN.
  ["img_icon_HeroProfile_BGOrange.png", "frame/legendary.png"],
  ["img_icon_HeroProfile_BGPurple.png", "frame/epic.png"],
  ["img_icon_HeroProfile_BGBlue.png",   "frame/elite.png"],
  ["img_icon_HeroProfile_BGGreen.png",  "frame/advanced.png"],
  ["img_icon_HeroProfile_BGMask.png",        "frame/ring-gold.png"],
  ["img_icon_HeroProfile_BGMask_Orange.png", "frame/ring-silver.png"],
  ["img_icon_HeroProfile_BGMask_pink.png",   "frame/ring-pink.png"],

  // Loại quân — sáu viên kim cương đỏ trong bộ lọc chỉ huy.
  ["btn_BlackSmithsShopSystemInfantry.png",    "troop/infantry.png"],
  ["btn_BlackSmithsShopSystemCavalry.png",     "troop/cavalry.png"],
  ["btn_BlackSmithsShopSystemArcher.png",      "troop/archer.png"],
  ["btn_BlackSmithsShopSystemVehicle.png",     "troop/siege.png"],
  ["btn_BlackSmithsShopSystemLeadership.png",  "troop/leadership.png"],
  ["btn_BlackSmithsShopSystemIntegration.png", "troop/integration.png"],

  // Khung ô trang bị — hình thoi phát sáng, dùng làm nền cho mọi ô.
  ["img_EquipSlotSelectFX.png", "fx/slot-frame.png"],
  ["img_EquipBtnSelectFX.png",  "fx/btn-select.png"],
  ["img_EquipBtnSelectFX4.png", "fx/btn-select-4.png"],
  ["img_Formation_bg.png",      "fx/formation-bg.png"],
];

// Tám ô trang bị, dùng bộ huyền thoại (nhóm 5) làm ảnh mặc định.
for (const [slot, n] of [["helmet",15],["chest",28],["weapon",5],["gloves",47],
                         ["legs",19],["boots",60],["acc1",39],["acc2",40]]) {
  MAP.push([`img_icon_item_equip_5_${n}.png`, `equip/${slot}.png`]);
}
for (const n of [100,101,102,103,104,105]) MAP.push([`img_icon_Armament_${n}.png`, `armament/${n}.png`]);
for (let n = 1; n <= 6; n += 1) MAP.push([`img_ItemTemplatFormationIcon${n}.png`, `formation/${n}.png`]);

const flags = new Set(process.argv.slice(2));
if (flags.has("--portraits")) {
  for (const name of files.keys()) {
    const found = /^img_icon_HeroProfile_(\d+[a-zA-Z]*)\.png$/.exec(name);
    if (found) MAP.push([name, `hero/${found[1]}.png`]);
  }
}
if (flags.has("--skills")) {
  for (const name of files.keys()) {
    const found = /^img_(WakeUp)?HeroSkill(\d+)\.png$/.exec(name);
    if (found) MAP.push([name, `skill/${found[1] ? "wake-" : ""}${found[2]}.png`]);
  }
}

let copied = 0;
const missing = [];
const ambiguous = [];
for (const [from, to] of MAP) {
  const found = files.get(from);
  if (!found) { missing.push(from); continue; }
  if (found.duplicates.length) ambiguous.push(from);
  const target = join(OUT, to);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(found.path, target);
  copied += 1;
}

console.log(`chép ${copied} file sang public/game`);
// Thiếu file thì nói ra. Im lặng bỏ qua sẽ thành một ô trống trên web mà không
// ai biết là do thiếu ảnh hay do chưa nhập dữ liệu.
if (missing.length) {
  console.warn(`\nthiếu ${missing.length} file:`);
  for (const name of missing.slice(0, 15)) console.warn(`  - ${name}`);
  if (missing.length > 15) console.warn(`  ... và ${missing.length - 15} file nữa`);
}
if (ambiguous.length) {
  console.warn(`\n${ambiguous.length} tên file xuất hiện ở nhiều thư mục, đã lấy bản gặp trước:`);
  for (const name of ambiguous.slice(0, 8)) console.warn(`  - ${name}`);
}
