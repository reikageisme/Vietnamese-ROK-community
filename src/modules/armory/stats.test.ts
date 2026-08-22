import { describe, expect, it } from "vitest";

import { aggregate, contributionsFrom, diffSheets } from "./stats";
import type { Contribution, StatDefinition, SourceRef } from "./types";

const DEFS: StatDefinition[] = [
  { key: "inf_atk", kind: "PERCENT", stackRule: "ADDITIVE", group: "infantry", sortOrder: 1 },
  { key: "inf_def", kind: "PERCENT", stackRule: "MULTIPLICATIVE", group: "infantry", sortOrder: 2 },
  { key: "march_speed", kind: "PERCENT", stackRule: "MAX_ONLY", group: "march", sortOrder: 1 },
  { key: "attack_flat", kind: "FLAT", stackRule: "MULTIPLICATIVE", group: "general", sortOrder: 1 },
];

function source(over: Partial<SourceRef> = {}): SourceRef {
  return {
    kind: "EQUIPMENT",
    id: "e1",
    label: "Mũ mẫu · bậc IV",
    verification: "CONFIRMED",
    ...over,
  };
}

function give(statKey: string, value: number, over: Partial<SourceRef> = {}): Contribution {
  return { statKey, value, source: source({ id: `${statKey}-${value}`, ...over }) };
}

describe("bộ tính chỉ số kho trang bị", () => {
  it("cộng dồn tuyến tính khi quy tắc là ADDITIVE", () => {
    const sheet = aggregate(DEFS, [give("inf_atk", 5), give("inf_atk", 3.5)]);
    expect(sheet.byKey.inf_atk.total).toBe(8.5);
  });

  it("nhân dồn phần trăm chứ không cộng thẳng", () => {
    // 5% rồi 3% ra 8,15% — đây chính là chỗ mọi bảng tính tự chế làm sai.
    const sheet = aggregate(DEFS, [give("inf_def", 5), give("inf_def", 3)]);
    expect(sheet.byKey.inf_def.total).toBe(8.15);
  });

  it("chỉ lấy giá trị lớn nhất khi quy tắc là MAX_ONLY", () => {
    const sheet = aggregate(DEFS, [give("march_speed", 10), give("march_speed", 25), give("march_speed", 4)]);
    expect(sheet.byKey.march_speed.total).toBe(25);
  });

  it("tách phần có điều kiện khỏi tổng luôn có hiệu lực", () => {
    const sheet = aggregate(DEFS, [
      give("inf_atk", 10),
      give("inf_atk", 15, { conditional: true, kind: "EQUIPMENT_TALENT", label: "Khi tấn công thành" }),
    ]);
    expect(sheet.byKey.inf_atk.total).toBe(10);
    expect(sheet.byKey.inf_atk.conditionalTotal).toBe(15);
  });

  it("bỏ chỉ số lạ và nói ra, thay vì đoán quy tắc gộp", () => {
    const sheet = aggregate(DEFS, [give("inf_atk", 5), give("chi_so_bia", 999)]);
    expect(sheet.byKey.chi_so_bia).toBeUndefined();
    expect(sheet.byKey.inf_atk.total).toBe(5);
    expect(sheet.warnings.join(" ")).toContain("chi_so_bia");
  });

  it("bỏ giá trị không phải số hữu hạn", () => {
    const sheet = aggregate(DEFS, [give("inf_atk", Number.NaN), give("inf_atk", 7)]);
    expect(sheet.byKey.inf_atk.total).toBe(7);
    expect(sheet.warnings).toHaveLength(1);
  });

  it("hạ nhân dồn về cộng dồn cho chỉ số cộng thẳng, và cảnh báo", () => {
    const sheet = aggregate(DEFS, [give("attack_flat", 100), give("attack_flat", 50)]);
    expect(sheet.byKey.attack_flat.total).toBe(150);
    expect(sheet.byKey.attack_flat.stackRule).toBe("ADDITIVE");
    expect(sheet.warnings.join(" ")).toContain("attack_flat");
  });

  it("một dòng chỉ đáng tin bằng nguồn yếu nhất của nó", () => {
    const sheet = aggregate(DEFS, [
      give("inf_atk", 5, { verification: "CONFIRMED" }),
      give("inf_atk", 2, { verification: "UNVERIFIED" }),
      give("inf_atk", 1, { verification: "SCREENSHOT" }),
    ]);
    expect(sheet.byKey.inf_atk.verification).toBe("UNVERIFIED");
  });

  it("liệt kê nguồn chưa kiểm chứng, không trùng lặp", () => {
    const unverified = { verification: "UNVERIFIED" as const, id: "same", kind: "INSCRIPTION" as const };
    const sheet = aggregate(DEFS, [
      { statKey: "inf_atk", value: 3, source: source(unverified) },
      { statKey: "inf_def", value: 3, source: source(unverified) },
    ]);
    expect(sheet.unverifiedSources).toHaveLength(1);
  });

  it("giữ lại mọi đóng góp để truy nguồn từng con số", () => {
    const sheet = aggregate(DEFS, [
      give("inf_atk", 12, { label: "Mũ · bậc IV" }),
      give("inf_atk", 8, { label: "Minh văn cấp 3", kind: "INSCRIPTION" }),
    ]);
    expect(sheet.byKey.inf_atk.contributions.map((item) => item.source.label)).toEqual([
      "Mũ · bậc IV",
      "Minh văn cấp 3",
    ]);
  });

  it("sắp xếp theo nhóm rồi tới thứ tự trong nhóm", () => {
    const sheet = aggregate(DEFS, [give("march_speed", 5), give("inf_def", 5), give("inf_atk", 5)]);
    expect(sheet.lines.map((line) => line.key)).toEqual(["inf_atk", "inf_def", "march_speed"]);
  });

  it("build rỗng cho bảng rỗng chứ không nổ", () => {
    const sheet = aggregate(DEFS, []);
    expect(sheet.lines).toEqual([]);
    expect(sheet.warnings).toEqual([]);
  });

  it("diffSheets chỉ trả về dòng thật sự đổi, lớn nhất trước", () => {
    const before = aggregate(DEFS, [give("inf_atk", 10), give("march_speed", 5)]);
    const after = aggregate(DEFS, [give("inf_atk", 18), give("march_speed", 5)]);
    expect(diffSheets(before, after)).toEqual([
      { key: "inf_atk", before: 10, after: 18, delta: 8 },
    ]);
  });

  it("contributionsFrom bỏ qua giá trị không phải số trong JSON", () => {
    const items = contributionsFrom({ inf_atk: 5, ghi_chu: "abc", inf_def: 2 }, source());
    expect(items.map((item) => item.statKey)).toEqual(["inf_atk", "inf_def"]);
  });
});
