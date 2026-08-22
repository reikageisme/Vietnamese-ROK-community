import { describe, expect, it } from "vitest";

import { validateDataset, validateEquipmentFile, type EquipmentFile } from "./dataset";

const KEYS = ["inf_atk", "inf_def"];
const PATCHES = ["2026.08"];

function file(over: Partial<EquipmentFile> = {}): EquipmentFile {
  return {
    slug: "mu-mau",
    nameVi: "Mũ mẫu",
    slot: "HELMET",
    rarity: "LEGENDARY",
    patch: "2026.08",
    tiers: [{ tier: 1, stats: { inf_atk: 2 } }],
    ...over,
  };
}

describe("kiểm tra file dữ liệu trang bị", () => {
  it("chấp nhận file tối thiểu hợp lệ", () => {
    expect(validateEquipmentFile(file(), KEYS, PATCHES).errors).toEqual([]);
  });

  it("từ chối chỉ số không có trong từ điển", () => {
    const result = validateEquipmentFile(file({ tiers: [{ tier: 1, stats: { bay_gio: 5 } }] }), KEYS, PATCHES);
    expect(result.errors.join(" ")).toContain("bay_gio");
  });

  it("từ chối chỉ số không phải số", () => {
    const bad = { tier: 1, stats: { inf_atk: "5%" as unknown as number } };
    expect(validateEquipmentFile(file({ tiers: [bad] }), KEYS, PATCHES).errors.join(" ")).toContain("phải là số");
  });

  it("từ chối khai trùng bậc", () => {
    const result = validateEquipmentFile(
      file({ tiers: [{ tier: 2, stats: { inf_atk: 1 } }, { tier: 2, stats: { inf_atk: 2 } }] }),
      KEYS, PATCHES,
    );
    expect(result.errors.join(" ")).toContain("khai hai lần");
  });

  it("bắt buộc có patch", () => {
    expect(validateEquipmentFile(file({ patch: "" }), KEYS, PATCHES).errors.join(" ")).toContain("patch");
  });

  it("từ chối patch chưa khai báo", () => {
    expect(validateEquipmentFile(file({ patch: "1999.01" }), KEYS, PATCHES).errors.join(" ")).toContain("1999.01");
  });

  it("đánh dấu đã kiểm chứng thì bắt buộc kèm ảnh", () => {
    const result = validateEquipmentFile(
      file({ tiers: [{ tier: 1, stats: { inf_atk: 2 }, verification: "SCREENSHOT" }] }),
      KEYS, PATCHES,
    );
    expect(result.errors.join(" ")).toContain("evidence");
  });

  it("có ảnh thì cho qua", () => {
    const result = validateEquipmentFile(
      file({ tiers: [{ tier: 1, stats: { inf_atk: 2 }, verification: "SCREENSHOT", evidence: "shots/mu__t1.png" }] }),
      KEYS, PATCHES,
    );
    expect(result.errors).toEqual([]);
  });

  it("cảnh báo khi nhảy cóc bậc, nhưng không chặn", () => {
    const result = validateEquipmentFile(
      file({ tiers: [{ tier: 1, stats: { inf_atk: 1 } }, { tier: 4, stats: { inf_atk: 4 } }] }),
      KEYS, PATCHES,
    );
    expect(result.errors).toEqual([]);
    expect(result.warnings.join(" ")).toContain("nhảy cóc");
  });

  it("từ chối talent mở ở bậc chưa khai", () => {
    const result = validateEquipmentFile(
      file({ talents: [{ unlockTier: 9, nameVi: "Xung phong", effect: { stats: { inf_atk: 5 } } }] }),
      KEYS, PATCHES,
    );
    expect(result.errors.join(" ")).toContain("bậc 9");
  });

  it("cảnh báo talent có điều kiện mà không ghi điều kiện", () => {
    const result = validateEquipmentFile(
      file({ talents: [{ unlockTier: 1, nameVi: "Công thành", conditional: true, effect: { stats: { inf_atk: 5 } } }] }),
      KEYS, PATCHES,
    );
    expect(result.warnings.join(" ")).toContain("điều kiện");
  });

  it("từ chối slot và rarity sai", () => {
    const result = validateEquipmentFile(file({ slot: "MU", rarity: "THAN" }), KEYS, PATCHES);
    expect(result.errors).toHaveLength(2);
  });

  it("bắt trùng slug giữa các file", () => {
    const result = validateDataset([file(), file()], KEYS, PATCHES);
    expect(result.errors.join(" ")).toContain("xuất hiện trong 2 file");
  });

  it("không nổ khi nhận rác", () => {
    expect(validateEquipmentFile(null as unknown as EquipmentFile, KEYS).errors).toHaveLength(1);
  });
});
