import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { validateDataset, type EquipmentFile } from "./dataset";

/** Kiểm tra dữ liệu thật trong `content/armory`, không phải dữ liệu bịa trong test.
 *
 * Nhờ vậy `npm test` chặn được số nhập sai TRƯỚC khi nó vào cơ sở dữ liệu — sau
 * khi vào rồi thì một con số sai trông y hệt một con số đúng. */

const ROOT = join(process.cwd(), "content", "armory");

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(ROOT, name), "utf8")) as T;
}

describe("dữ liệu kho trang bị", () => {
  const definitions = readJson<{ stats: { key: string; group: string; kind: string; stackRule: string }[] }>(
    "stat-definitions.json",
  );
  const patches = readJson<{ patches: { version: string }[] }>("patches.json");

  it("từ điển chỉ số không có khoá trùng", () => {
    const keys = definitions.stats.map((stat) => stat.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("mỗi chỉ số khai đủ nhóm, loại và quy tắc gộp", () => {
    for (const stat of definitions.stats) {
      expect(stat.group, stat.key).toBeTruthy();
      expect(["FLAT", "PERCENT"], stat.key).toContain(stat.kind);
      expect(["ADDITIVE", "MULTIPLICATIVE", "MAX_ONLY"], stat.key).toContain(stat.stackRule);
    }
  });

  it("có ít nhất một phiên bản game được khai báo", () => {
    expect(patches.patches.length).toBeGreaterThan(0);
  });

  it("mọi file trang bị đều hợp lệ", () => {
    const directory = join(ROOT, "equipment");
    if (!existsSync(directory)) return;
    // File bắt đầu bằng _ là mẫu, không phải dữ liệu.
    const names = readdirSync(directory).filter((name) => name.endsWith(".json") && !name.startsWith("_"));
    const files = names.map((name) => JSON.parse(readFileSync(join(directory, name), "utf8")) as EquipmentFile);

    const result = validateDataset(
      files,
      definitions.stats.map((stat) => stat.key),
      patches.patches.map((patch) => patch.version),
    );
    expect(result.errors).toEqual([]);
  });
});
