#!/usr/bin/env node
/** Đọc bảng tính nạp liệu, xuất ra các file JSON trong `content/armory`.
 *
 * Người nhập liệu gõ vào Excel vì Excel là thứ họ đã biết dùng; web đọc JSON vì
 * JSON là thứ git so sánh được và test kiểm được. Script này là cái cầu.
 *
 * Nguyên tắc: thà DỪNG với một thông báo rõ ràng còn hơn nạp một phần rồi để
 * trang web hiện ra dữ liệu thiếu. Một món đồ thiếu nửa số chỉ số trông y hệt
 * một món đồ chỉ có ngần ấy chỉ số.
 *
 *   node scripts/intake.mjs [đường-dẫn-file.xlsx]
 */

import ExcelJS from "exceljs";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const BOOK = process.argv[2] ?? join(ROOT, "docs", "data-intake", "rokfaq-nap-du-lieu.xlsx");
const CONTENT = join(ROOT, "content", "armory");

const errors = [];
const warnings = [];
const fail = (message) => errors.push(message);

if (!existsSync(BOOK)) {
  console.error(`Không thấy bảng tính: ${BOOK}`);
  process.exit(1);
}

/* ------------------------------------------------------------------ đọc ô */

/** Ô trong ExcelJS có thể là chuỗi, số, công thức, hoặc rich text. Gom về một mối. */
function text(cell) {
  const v = cell?.value;
  if (v == null) return "";
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((part) => part.text).join("").trim();
    if (v.text != null) return String(v.text).trim();
    if (v.result != null) return String(v.result).trim();
    return "";
  }
  return String(v).trim();
}

function num(cell, where, field) {
  const raw = text(cell);
  if (raw === "") return null;
  // Nguoi Viet go dau phay lam dau thap phan; Excel co the giu nguyen chuoi.
  const cleaned = raw.replace(/%/g, "").replace(/\s/g, "").replace(",", ".");
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    fail(`${where}: "${field}" phải là số, đang là "${raw}".`);
    return null;
  }
  return value;
}

const yes = (cell) => /^(có|co|x|yes|true|1)$/i.test(text(cell));
const list = (cell) => text(cell).split(",").map((s) => s.trim()).filter(Boolean);

/** Dòng ví dụ có sẵn trong file mẫu — bỏ qua, không bắt người dùng phải xoá. */
const isExample = (slug, art) => /^vi-du-/i.test(slug) || /^vd$/i.test(art ?? "");

const TROOP = { "bộ binh":"infantry", "kỵ binh":"cavalry", "cung thủ":"archer",
                "công thành":"siege", "lãnh đạo":"leadership", "kết hợp":"integration" };
const SLOT = { "mũ":"HELMET", "giáp":"CHEST", "vũ khí":"WEAPON", "găng tay":"GLOVES",
               "giáp chân":"LEGS", "giày":"BOOTS", "phụ kiện":"ACCESSORY" };
const RARITY = { "huyền thoại":"LEGENDARY", "sử thi":"EPIC", "tinh nhuệ":"ELITE",
                 "cao cấp":"ADVANCED", "thường":"NORMAL" };
const ROLE = { "đa năng":"versatile", "đồn trú":"garrison", "chinh phạt":"conquest",
               "giữ hoà bình":"peace", "giữ hòa bình":"peace", "thu thập":"gather" };

function mapped(table, value, where, field) {
  if (!value) return null;
  const key = value.toLowerCase();
  if (!(key in table)) {
    fail(`${where}: ${field} "${value}" không nằm trong danh sách cho phép.`);
    return null;
  }
  return table[key];
}

/* ------------------------------------------------------------------ chạy */

const book = new ExcelJS.Workbook();
await book.xlsx.readFile(BOOK);

const sheet = (name) => {
  const found = book.getWorksheet(name);
  if (!found) fail(`Bảng tính thiếu sheet "${name}".`);
  return found;
};

/** Duyệt các dòng dữ liệu, bỏ dòng tiêu đề và dòng trống. */
function rows(ws, firstDataRow = 3) {
  const out = [];
  if (!ws) return out;
  ws.eachRow((row, index) => {
    if (index < firstDataRow) return;
    const filled = row.values.some((v) => v != null && String(v).trim() !== "");
    if (filled) out.push({ row, index });
  });
  return out;
}

// Tu dien chi so: nguon su that van la file JSON trong repo, khong phai sheet.
// Sheet chi la ban sao de nguoi dung chon; neu hai ben lech thi file JSON dung.
const statFile = join(CONTENT, "stat-definitions.json");
const statKeys = new Set(
  JSON.parse(readFileSync(statFile, "utf8")).stats.map((stat) => stat.key),
);
const checkStat = (key, where) => {
  if (!key) return null;
  if (!statKeys.has(key)) {
    fail(`${where}: chỉ số "${key}" không có trong stat-definitions.json.`);
    return null;
  }
  return key;
};

const patchFile = join(CONTENT, "patches.json");
const patches = JSON.parse(readFileSync(patchFile, "utf8")).patches;
const PATCH = patches.at(-1)?.version;
if (!PATCH) fail("patches.json chưa khai phiên bản game nào.");

/* --- chỉ huy --- */
const commanders = new Map();
for (const { row, index } of rows(sheet("Chỉ huy"))) {
  const art = text(row.getCell(1));
  const slug = text(row.getCell(2));
  if (isExample(slug, art)) continue;
  if (!slug) continue;                       // dòng chỉ có id ảnh: chưa ai điền, bỏ qua
  const where = `Chỉ huy!dòng ${index}`;
  if (commanders.has(slug)) fail(`${where}: slug "${slug}" đã dùng ở dòng khác.`);

  commanders.set(slug, {
    slug,
    art: art || null,
    nameVi: text(row.getCell(3)),
    nameEn: text(row.getCell(4)) || null,
    rarity: mapped(RARITY, text(row.getCell(5)), where, "độ hiếm"),
    troop: mapped(TROOP, text(row.getCell(6)), where, "loại quân chính"),
    troops: [text(row.getCell(6)), text(row.getCell(7))]
      .filter(Boolean).map((v) => mapped(TROOP, v, where, "loại quân")).filter(Boolean),
    roles: list(row.getCell(8)).map((v) => mapped(ROLE, v, where, "bối cảnh")).filter(Boolean),
    maxStars: num(row.getCell(9), where, "sao tối đa"),
    note: text(row.getCell(10)) || null,
    skills: [],
    talents: [],
  });
  if (!commanders.get(slug).nameVi) fail(`${where}: thiếu tên tiếng Việt.`);
}

/* --- kỹ năng --- */
for (const { row, index } of rows(sheet("Kỹ năng"))) {
  const slug = text(row.getCell(1));
  if (isExample(slug)) continue;
  const where = `Kỹ năng!dòng ${index}`;
  const owner = commanders.get(slug);
  if (!owner) { fail(`${where}: chưa có chỉ huy nào mang slug "${slug}".`); continue; }
  owner.skills.push({
    order: num(row.getCell(2), where, "thứ tự"),
    name: text(row.getCell(3)),
    art: text(row.getCell(4)) || null,
    kind: text(row.getCell(5)) || null,
    text: text(row.getCell(6)) || null,
    levels: [7, 8, 9, 10, 11].map((col) => text(row.getCell(col))).filter(Boolean),
  });
}

/* --- tài năng --- */
const sharedTalents = [];
for (const { row, index } of rows(sheet("Tài năng"))) {
  const slug = text(row.getCell(1));
  if (isExample(slug)) continue;
  const where = `Tài năng!dòng ${index}`;
  const node = {
    branch: mapped(TROOP, text(row.getCell(2)), where, "nhánh"),
    name: text(row.getCell(3)),
    art: text(row.getCell(4)) || null,
    statKey: checkStat(text(row.getCell(5)), where),
    perPoint: num(row.getCell(6), where, "mỗi điểm"),
    maxPoints: num(row.getCell(7), where, "điểm tối đa"),
    tier: num(row.getCell(8), where, "hàng"),
    text: text(row.getCell(9)) || null,
  };
  if (!slug) { sharedTalents.push(node); continue; }
  const owner = commanders.get(slug);
  if (!owner) { fail(`${where}: chưa có chỉ huy nào mang slug "${slug}".`); continue; }
  owner.talents.push(node);
}

/* --- trang bị --- */
const equipment = new Map();
for (const { row, index } of rows(sheet("Trang bị"))) {
  const slug = text(row.getCell(1));
  if (isExample(slug)) continue;
  const where = `Trang bị!dòng ${index}`;
  if (!slug) { fail(`${where}: thiếu slug.`); continue; }
  if (equipment.has(slug)) fail(`${where}: slug "${slug}" đã dùng ở dòng khác.`);

  const troop = text(row.getCell(11));
  const percent = num(row.getCell(12), where, "tài năng đặc biệt · %");
  const evidence = text(row.getCell(13)) || null;

  equipment.set(slug, {
    slug,
    nameVi: text(row.getCell(2)),
    nameEn: text(row.getCell(3)) || null,
    slot: mapped(SLOT, text(row.getCell(4)), where, "ô"),
    rarity: mapped(RARITY, text(row.getCell(5)), where, "độ hiếm"),
    equipmentLevel: num(row.getCell(6), where, "cấp độ trang bị"),
    seasonLimited: yes(row.getCell(7)),
    patch: PATCH,
    maxTier: num(row.getCell(8), where, "bậc tối đa") ?? 5,
    // Cot nay la ly do ca bang tinh nay chay duoc: cac so o hai sheet duoi doc
    // theo BAC NAY, khong phai bac I. Doan sai bac la lech ca bang.
    baseTier: num(row.getCell(9), where, "bậc trong ảnh") ?? 1,
    art: text(row.getCell(10)) || null,
    baseStats: [],
    iconic: [],
    specialTalent: troop
      ? { troopType: mapped(TROOP, troop, where, "tài năng đặc biệt · loại quân"),
          bonusPercent: percent ?? 30 }
      : null,
    verification: evidence ? "SCREENSHOT" : "UNVERIFIED",
    evidence,
    note: text(row.getCell(14)) || null,
  });
  if (!equipment.get(slug).nameVi) fail(`${where}: thiếu tên tiếng Việt.`);
}

for (const { row, index } of rows(sheet("Chỉ số trang bị"))) {
  const slug = text(row.getCell(1));
  if (isExample(slug)) continue;
  const where = `Chỉ số trang bị!dòng ${index}`;
  const item = equipment.get(slug);
  if (!item) { fail(`${where}: chưa có trang bị nào mang slug "${slug}".`); continue; }
  const statKey = checkStat(text(row.getCell(2)), where);
  if (!statKey) continue;
  item.baseStats.push({
    statKey,
    base: num(row.getCell(3), where, "giá trị nền") ?? 0,
    perTier: num(row.getCell(4), where, "mức tăng mỗi bậc") ?? 0,
  });
}

for (const { row, index } of rows(sheet("Biểu trưng"))) {
  const slug = text(row.getCell(1));
  if (isExample(slug)) continue;
  const where = `Biểu trưng!dòng ${index}`;
  const item = equipment.get(slug);
  if (!item) { fail(`${where}: chưa có trang bị nào mang slug "${slug}".`); continue; }
  const level = num(row.getCell(2), where, "cấp");
  const rawKey = text(row.getCell(3));
  const effectName = text(row.getCell(6));
  if (!rawKey && !effectName) {
    fail(`${where}: mục biểu trưng phải có khoá chỉ số HOẶC tên hiệu ứng.`);
    continue;
  }
  item.iconic.push({
    level,
    statKey: rawKey ? checkStat(rawKey, where) : null,
    base: rawKey ? num(row.getCell(4), where, "giá trị nền") : null,
    perTier: rawKey ? num(row.getCell(5), where, "mức tăng") ?? 0 : null,
    nameVi: effectName || null,
    descriptionVi: text(row.getCell(7)) || null,
    conditional: yes(row.getCell(8)),
  });
}

/* --- minh văn, vũ trang --- */
const inscriptions = [];
for (const { row, index } of rows(sheet("Minh văn"))) {
  const slug = text(row.getCell(1));
  if (isExample(slug)) continue;
  const where = `Minh văn!dòng ${index}`;
  if (!slug) { fail(`${where}: thiếu slug.`); continue; }
  const stats = {};
  for (const [keyCol, valCol] of [[7, 8], [9, 10]]) {
    const key = checkStat(text(row.getCell(keyCol)), where);
    if (key) stats[key] = num(row.getCell(valCol), where, "giá trị") ?? 0;
  }
  inscriptions.push({
    slug, nameVi: text(row.getCell(2)), nameEn: text(row.getCell(3)) || null,
    level: num(row.getCell(4), where, "cấp") ?? 1,
    art: text(row.getCell(5)) || null,
    slots: list(row.getCell(6)).map((v) => mapped(SLOT, v, where, "ô lắp được")).filter(Boolean),
    stats, patch: PATCH, note: text(row.getCell(11)) || null,
  });
}

const armaments = [];
for (const { row, index } of rows(sheet("Vũ trang"))) {
  const slug = text(row.getCell(1));
  if (isExample(slug)) continue;
  const where = `Vũ trang!dòng ${index}`;
  if (!slug) { fail(`${where}: thiếu slug.`); continue; }
  const stats = {};
  for (const [keyCol, valCol] of [[8, 9], [10, 11], [12, 13]]) {
    const key = checkStat(text(row.getCell(keyCol)), where);
    if (key) stats[key] = num(row.getCell(valCol), where, "giá trị") ?? 0;
  }
  armaments.push({
    slug, nameVi: text(row.getCell(2)), nameEn: text(row.getCell(3)) || null,
    art: text(row.getCell(4)) || null,
    formation: text(row.getCell(5)) || null,
    inscriptionTags: list(row.getCell(6)),
    tier: num(row.getCell(7), where, "bậc") ?? 1,
    stats, patch: PATCH, note: text(row.getCell(14)) || null,
  });
}

/* ------------------------------------------------------------------ ghi */

if (errors.length) {
  console.error(`\nDỪNG — ${errors.length} lỗi, chưa ghi file nào:\n`);
  for (const message of errors) console.error("  · " + message);
  console.error("\nSửa trong bảng tính rồi chạy lại.");
  process.exit(1);
}

// Cảnh báo không chặn: dữ liệu vẫn dùng được, chỉ là chưa đầy đủ.
for (const item of equipment.values()) {
  if (!item.baseStats.length && !item.iconic.length) {
    warnings.push(`${item.slug}: chưa có dòng chỉ số nào ở hai sheet bên dưới.`);
  }
}
for (const c of commanders.values()) {
  if (!c.skills.length) warnings.push(`${c.slug}: chưa nhập kỹ năng nào.`);
  c.skills.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

const write = (path, value) => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
};

write(join(CONTENT, "commanders.json"), { commanders: [...commanders.values()], sharedTalents });
write(join(CONTENT, "inscriptions.json"), { inscriptions });
write(join(CONTENT, "armaments.json"), { armaments });
for (const item of equipment.values()) {
  const { note, ...rest } = item;
  write(join(CONTENT, "equipment", `${item.slug}.json`), note ? { ...rest, _ghi_chu: note } : rest);
}

console.log(`chỉ huy    ${commanders.size}`);
console.log(`trang bị   ${equipment.size}`);
console.log(`minh văn   ${inscriptions.length}`);
console.log(`vũ trang   ${armaments.length}`);
if (warnings.length) {
  console.log(`\n${warnings.length} cảnh báo (không chặn):`);
  for (const message of warnings) console.log("  · " + message);
}
console.log("\nChạy `npm test` để kiểm tra lại trước khi build.");
