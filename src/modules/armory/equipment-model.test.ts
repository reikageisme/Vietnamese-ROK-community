import { describe, expect, it } from "vitest";

import {
  resolveAllTiers,
  resolveEquipment,
  toContributions,
  valueAtTier,
  type EquipmentSource,
} from "./equipment-model";

/** Dựng theo đúng hình dạng panel trong game: nền + mức tăng, biểu trưng I–V. */
const SAMPLE: EquipmentSource = {
  slug: "mau-thu",
  nameVi: "Mẫu Thử",
  slot: "CHEST",
  rarity: "LEGENDARY",
  equipmentLevel: 45,
  maxTier: 5,
  baseTier: 1,
  baseStats: [{ statKey: "inf_def", base: 12, perTier: 4 }],
  iconic: [
    { level: 1, statKey: "inf_def_flat", base: 3, perTier: 1 },
    { level: 2, statKey: "enemy_atk_ignore", base: 1, perTier: 0.5 },
    { level: 3, statKey: "march_capacity", base: 500, perTier: 150 },
    { level: 4, statKey: "damage_vs_rally_garrison", base: 1, perTier: 0.5 },
    {
      level: 5,
      nameVi: "Đòn Trả Thù",
      descriptionVi: "Có xác suất phản đòn khi trúng đòn tấn công cơ bản.",
      conditional: true,
    },
  ],
  specialTalent: { troopType: "infantry", bonusPercent: 30 },
};

describe("valueAtTier", () => {
  it("cộng dồn mức tăng theo số bậc đã nâng", () => {
    const line = { statKey: "inf_def", base: 12, perTier: 4 };
    expect(valueAtTier(line, 1)).toBe(12);
    expect(valueAtTier(line, 5)).toBe(28);
  });

  it("đếm từ baseTier chứ không mặc định là bậc I", () => {
    const line = { statKey: "x", base: 3, perTier: 1 };
    expect(valueAtTier(line, 3, 3)).toBe(3);
    expect(valueAtTier(line, 5, 3)).toBe(5);
  });
});

describe("resolveEquipment", () => {
  it("mục biểu trưng chưa tới bậc thì chưa mở và không có giá trị", () => {
    const at2 = resolveEquipment(SAMPLE, { tier: 2 });
    const levels = Object.fromEntries(at2.iconic.map((e) => [e.level, e.unlocked]));
    expect(levels).toEqual({ 1: true, 2: true, 3: false, 4: false, 5: false });
    expect(at2.iconic.find((e) => e.level === 3)?.value ?? null).toBeNull();
  });

  it("mục biểu trưng lớn dần kể từ bậc mở ra nó, không phải từ bậc I", () => {
    const at5 = resolveEquipment(SAMPLE, { tier: 5 });
    // Biểu trưng III mở ở bậc III với 500, tới bậc V là +2 lần 150.
    expect(at5.iconic.find((e) => e.level === 3)?.value).toBe(800);
    // Biểu trưng I mở ở bậc I với 3, tới bậc V là +4 lần 1.
    expect(at5.iconic.find((e) => e.level === 1)?.value).toBe(7);
  });

  it("bậc V là hiệu ứng có tên, không phải một con số", () => {
    const at5 = resolveEquipment(SAMPLE, { tier: 5 });
    const five = at5.iconic.find((e) => e.level === 5)!;
    expect(five.nameVi).toBe("Đòn Trả Thù");
    expect(five.value ?? null).toBeNull();
    expect(five.conditional).toBe(true);
  });

  it("không cộng tài năng đặc biệt khi chưa biết chỉ huy dùng loại quân nào", () => {
    const result = resolveEquipment(SAMPLE, { tier: 5 });
    expect(result.specialTalentActive).toBe(false);
    expect(result.baseStats[0].value).toBe(28);
    expect(result.warnings.join(" ")).toContain("chưa chọn chỉ huy");
  });

  it("cộng tài năng đặc biệt khi loại quân của chỉ huy khớp", () => {
    const result = resolveEquipment(SAMPLE, { tier: 5, commanderTroopType: "infantry" });
    expect(result.specialTalentActive).toBe(true);
    expect(result.baseStats[0].rawValue).toBe(28);
    expect(result.baseStats[0].value).toBe(36.4);
  });

  it("chỉ huy khác loại quân thì không được cộng", () => {
    const result = resolveEquipment(SAMPLE, { tier: 5, commanderTroopType: "cavalry" });
    expect(result.specialTalentActive).toBe(false);
    expect(result.baseStats[0].value).toBe(28);
  });

  it("tài năng đặc biệt không âm thầm nhân vào khối biểu trưng", () => {
    const result = resolveEquipment(SAMPLE, { tier: 5, commanderTroopType: "infantry" });
    expect(result.iconic.find((e) => e.level === 1)?.value).toBe(7);
    expect(result.warnings.join(" ")).toContain("Biểu Trưng");
  });

  it("delta là phần hơn so với bậc liền trước", () => {
    const at4 = resolveEquipment(SAMPLE, { tier: 4 });
    expect(at4.baseStats[0].delta).toBe(4);
    // Biểu trưng IV vừa mở ở bậc này nên toàn bộ giá trị là phần tăng thêm.
    expect(at4.iconic.find((e) => e.level === 4)?.delta).toBe(1);
  });

  it("kẹp bậc vượt khung và nói rõ đã kẹp", () => {
    const result = resolveEquipment(SAMPLE, { tier: 9 });
    expect(result.tier).toBe(5);
    expect(result.warnings.join(" ")).toContain("vượt bậc cao nhất");
  });

  it("resolveAllTiers trả đủ số bậc món đồ có", () => {
    const all = resolveAllTiers(SAMPLE);
    expect(all.map((r) => r.tier)).toEqual([1, 2, 3, 4, 5]);
    expect(all[0].baseStats[0].value).toBe(12);
    expect(all[4].baseStats[0].value).toBe(28);
  });
});

describe("toContributions", () => {
  it("không góp gì từ mục biểu trưng chưa mở", () => {
    const rows = toContributions(resolveEquipment(SAMPLE, { tier: 1 }), {
      label: "Mẫu Thử · bậc I",
      verification: "SCREENSHOT",
    });
    expect(rows.map((r) => r.statKey).sort()).toEqual(["inf_def", "inf_def_flat"]);
  });

  it("giữ nguyên cờ điều kiện để bộ tính tách khỏi tổng", () => {
    const rows = toContributions(resolveEquipment(SAMPLE, { tier: 5 }), {
      label: "Mẫu Thử · bậc V",
      verification: "SCREENSHOT",
    });
    const rally = rows.find((r) => r.statKey === "damage_vs_rally_garrison")!;
    expect(rally.source.kind).toBe("EQUIPMENT_TALENT");
    // Bậc V chỉ có lời mô tả nên không xuất hiện thành dòng số nào.
    expect(rows.some((r) => r.source.id.endsWith("#iconic-5"))).toBe(false);
  });
});
