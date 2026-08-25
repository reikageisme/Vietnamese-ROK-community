#!/usr/bin/env node
/** Chép biểu tượng cần dùng từ `game-assets/` sang `public/game/`.
 *
 * `game-assets/` là 89 MB rút ra từ bản cài game trên máy, và nó nằm trong
 * .gitignore. Repo chỉ mang theo đúng những file trang web thật sự hiển thị.
 *
 * Không ghép sẵn khung độ hiếm vào ảnh chân dung. Game cũng không làm vậy: nó
 * xếp một nền khung lên dưới một ảnh chân dung nền trong suốt. Giữ đúng cách đó
 * nghĩa là 168 chỉ huy chỉ cần 168 file, không phải 168 × 4 khung.
 *
 *   node scripts/pick-game-assets.mjs              # khung, loại quân, trang bị, minh văn, vũ trang
 *   node scripts/pick-game-assets.mjs --portraits  # thêm toàn bộ chân dung chỉ huy (~9 MB)
 *   node scripts/pick-game-assets.mjs --skills     # thêm toàn bộ biểu tượng kỹ năng
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "game-assets", "all");
const OUT = join(ROOT, "public", "game");

if (!existsSync(SRC)) {
  console.error(`Không thấy ${SRC}.`);
  console.error("Thư mục này rút ra từ bản cài game và không nằm trong git — bỏ qua.");
  process.exit(0);
}

/** [đường dẫn nguồn tương đối trong game-assets/all, đường dẫn đích trong public/game] */
const MAP = [
  // Khung độ hiếm — xếp dưới ảnh chân dung bằng CSS, không ghép sẵn vào ảnh.
  ["img_icon_HeroProfile_BGOrange.png", "frame/legendary.png"],
  ["img_icon_HeroProfile_BGPurple.png", "frame/epic.png"],
  ["img_icon_HeroProfile_BGBlue.png",   "frame/elite.png"],
  ["img_icon_HeroProfile_BGGreen.png",  "frame/advanced.png"],
  ["img_icon_HeroProfile_BGMask.png",   "frame/mask.png"],

  // Loại quân — sáu viên kim cương đỏ trong bộ lọc chỉ huy.
  ["btn_BlackSmithsShopSystemInfantry.png",    "troop/infantry.png"],
  ["btn_BlackSmithsShopSystemCavalry.png",     "troop/cavalry.png"],
  ["btn_BlackSmithsShopSystemArcher.png",      "troop/archer.png"],
  ["btn_BlackSmithsShopSystemVehicle.png",     "troop/siege.png"],
  ["btn_BlackSmithsShopSystemLeadership.png",  "troop/leadership.png"],
  ["btn_BlackSmithsShopSystemIntegration.png", "troop/integration.png"],

  // Hiệu ứng ô trang bị.
  ["img_EquipSlotSelectFX.png", "fx/slot-select.png"],
  ["img_EquipBtnSelectFX.png",  "fx/btn-select.png"],
];

// Trang bị huyền thoại dùng cho bản mẫu: nhóm 5 là huyền thoại.
for (const [slot, n] of [["helmet",15],["chest",28],["weapon",5],["gloves",47],
                         ["legs",19],["boots",60],["accessory",39]]) {
  MAP.push([join("trangbi", `img_icon_item_equip_5_${n}.png`), `equip/${slot}.png`]);
}
// Minh văn (tượng đá) và vũ trang.
for (const n of [1,3,4,5,6,7,8]) MAP.push([`img_icon_HeroCarving_${n}.png`, `inscription/${n}.png`]);
for (const n of [100,101,102,103,104,105]) MAP.push([`img_icon_Armament_${n}.png`, `armament/${n}.png`]);

const flags = new Set(process.argv.slice(2));
if (flags.has("--portraits")) {
  for (const name of readdirSync(SRC)) {
    const found = /^img_icon_HeroProfile_(\d+)\.png$/.exec(name);
    if (found) MAP.push([name, `hero/${found[1]}.png`]);
  }
}
if (flags.has("--skills")) {
  for (const name of readdirSync(SRC)) {
    const found = /^img_HeroSkill(\d+)\.png$/.exec(name);
    if (found) MAP.push([name, `skill/${found[1]}.png`]);
  }
}

let copied = 0;
const missing = [];
for (const [from, to] of MAP) {
  const source = join(SRC, from);
  if (!existsSync(source)) { missing.push(from); continue; }
  const target = join(OUT, to);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  copied += 1;
}

console.log(`chép ${copied} file sang public/game`);
// Thiếu file thì nói ra. Im lặng bỏ qua sẽ thành một ô trống trên web mà không
// ai biết là do thiếu ảnh hay do chưa nhập dữ liệu.
if (missing.length) {
  console.warn(`thiếu ${missing.length} file trong game-assets/all:`);
  for (const name of missing.slice(0, 12)) console.warn(`  - ${name}`);
  if (missing.length > 12) console.warn(`  ... và ${missing.length - 12} file nữa`);
}
