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

/** Dạng dữ liệu mới: chép panel trong game bằng "giá trị nền + mức tăng mỗi bậc". */
describe("dạng nền + mức tăng, và khối biểu trưng", () => {
  const KEYS2 = ["inf_atk", "inf_def", "inf_def_flat"];

  function growthFile(over: Partial<EquipmentFile> = {}): EquipmentFile {
    return {
      slug: "giap-mau",
      nameVi: "Giáp mẫu",
      slot: "CHEST",
      rarity: "LEGENDARY",
      patch: "2026.08",
      maxTier: 5,
      baseStats: [{ statKey: "inf_def", base: 12, perTier: 4 }],
      iconic: [{ level: 1, statKey: "inf_def_flat", base: 3, perTier: 1 }],
      ...over,
    };
  }

  it("chấp nhận file không có bảng bậc, chỉ có nền và mức tăng", () => {
    expect(validateEquipmentFile(growthFile(), KEYS2, PATCHES).errors).toEqual([]);
  });

  it("từ chối file không có bậc lẫn không có chỉ số nền", () => {
    const result = validateEquipmentFile(
      growthFile({ baseStats: [], iconic: [], tiers: undefined }),
      KEYS2, PATCHES,
    );
    expect(result.errors.join(" ")).toContain("chưa có chỉ số nào");
  });

  it("từ chối chỉ số nền không có trong từ điển", () => {
    const result = validateEquipmentFile(
      growthFile({ baseStats: [{ statKey: "bay_gio", base: 1, perTier: 1 }] }),
      KEYS2, PATCHES,
    );
    expect(result.errors.join(" ")).toContain("bay_gio");
  });

  it("từ chối mức tăng không phải số", () => {
    const bad = { statKey: "inf_def", base: 12, perTier: "4%" as unknown as number };
    expect(validateEquipmentFile(growthFile({ baseStats: [bad] }), KEYS2, PATCHES).errors.join(" "))
      .toContain("perTier phải là số");
  });

  it("từ chối mục biểu trưng vượt bậc cao nhất — mục đó không bao giờ mở được", () => {
    const result = validateEquipmentFile(
      growthFile({ iconic: [{ level: 7, statKey: "inf_def_flat", base: 1, perTier: 0 }] }),
      KEYS2, PATCHES,
    );
    expect(result.errors.join(" ")).toContain("vượt bậc cao nhất");
  });

  it("từ chối mục biểu trưng khai trùng bậc", () => {
    const result = validateEquipmentFile(
      growthFile({
        iconic: [
          { level: 2, statKey: "inf_def_flat", base: 1, perTier: 0 },
          { level: 2, statKey: "inf_atk", base: 1, perTier: 0 },
        ],
      }),
      KEYS2, PATCHES,
    );
    expect(result.errors.join(" ")).toContain("khai hai lần");
  });

  it("mục biểu trưng không có chỉ số thì bắt buộc phải có tên", () => {
    const result = validateEquipmentFile(
      growthFile({ iconic: [{ level: 5, descriptionVi: "Có gì đó xảy ra." }] }),
      KEYS2, PATCHES,
    );
    expect(result.errors.join(" ")).toContain("phải có nameVi");
  });

  it("chấp nhận mục biểu trưng là hiệu ứng có tên kèm mô tả", () => {
    const result = validateEquipmentFile(
      growthFile({
        iconic: [{ level: 5, nameVi: "Đòn Trả Thù", descriptionVi: "Phản đòn.", conditional: true }],
      }),
      KEYS2, PATCHES,
    );
    expect(result.errors).toEqual([]);
  });

  it("từ chối loại quân lạ ở tài năng đặc biệt", () => {
    const result = validateEquipmentFile(
      growthFile({ specialTalent: { troopType: "khong-quan", bonusPercent: 30 } }),
      KEYS2, PATCHES,
    );
    expect(result.errors.join(" ")).toContain("khong-quan");
  });

  it("khai đã có ảnh ở cấp file thì phải kèm đường dẫn ảnh", () => {
    const result = validateEquipmentFile(growthFile({ verification: "SCREENSHOT" }), KEYS2, PATCHES);
    expect(result.errors.join(" ")).toContain("evidence");
  });

  it("có đường dẫn ảnh thì được khai đã có ảnh", () => {
    const result = validateEquipmentFile(
      growthFile({ verification: "SCREENSHOT", evidence: "evidence/giap-mau.png" }),
      KEYS2, PATCHES,
    );
    expect(result.errors).toEqual([]);
  });
});
