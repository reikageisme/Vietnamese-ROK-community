import { describe, expect, it } from "vitest";

import {
  POSITIONS, SECONDARY_SCALE, computeSheet, emptyLoadout, estimatePower, skillSegments,
  type LabData,
} from "./lab";

const DEFS = [
  { key: "inf_atk", kind: "PERCENT", stackRule: "ADDITIVE", group: "infantry" },
  { key: "inf_def", kind: "PERCENT", stackRule: "ADDITIVE", group: "infantry" },
  { key: "skill_damage", kind: "PERCENT", stackRule: "ADDITIVE", group: "combat" },
  { key: "counter_damage", kind: "PERCENT", stackRule: "ADDITIVE", group: "combat" },
] as LabData["statDefinitions"];

const DATA: LabData = {
  statDefinitions: DEFS,
  statLabels: { inf_atk: "Tấn công Bộ binh", inf_def: "Phòng thủ Bộ binh" },
  commanders: [
    { slug: "bo-binh", name: "Chỉ huy Bộ binh", art: "1", rarity: "LEGENDARY", troop: "infantry",
      troops: ["infantry"], roles: [], maxStars: 6, stats: { inf_atk: 10 },
      verification: "UNVERIFIED", skills: [] },
    { slug: "ky-binh", name: "Chỉ huy Kỵ binh", art: null, rarity: "EPIC", troop: "cavalry",
      troops: ["cavalry"], roles: [], maxStars: 5, stats: { inf_atk: 4 },
      verification: "UNVERIFIED", skills: [] },
  ],
  equipment: [
    { slug: "giap", nameVi: "Giáp", slot: "CHEST", rarity: "LEGENDARY", art: null,
      maxTier: 5, baseTier: 1, verification: "UNVERIFIED",
      baseStats: [{ statKey: "inf_def", base: 10, perTier: 5 }],
      iconic: [
        { level: 1, statKey: "skill_damage", base: 2, perTier: 1 },
        { level: 2, statKey: "counter_damage", base: 4, perTier: 0, conditional: true },
      ],
      specialTalent: { troopType: "infantry", bonusPercent: 30 } },
    { slug: "nhan-a", nameVi: "Nhẫn A", slot: "ACCESSORY", rarity: "LEGENDARY", art: null,
      maxTier: 5, baseTier: 1, verification: "UNVERIFIED",
      baseStats: [{ statKey: "inf_atk", base: 2, perTier: 0 }], iconic: [], specialTalent: null },
    { slug: "nhan-b", nameVi: "Nhẫn B", slot: "ACCESSORY", rarity: "LEGENDARY", art: null,
      maxTier: 5, baseTier: 1, verification: "UNVERIFIED",
      baseStats: [{ statKey: "inf_atk", base: 3, perTier: 0 }], iconic: [], specialTalent: null },
  ],
  inscriptions: [{ slug: "khac", nameVi: "Khắc", art: 1, stats: { skill_damage: 3 } }],
  formations: [{ slug: "gong-kim", nameVi: "Gọng Kìm", troop: "infantry", art: 1, stats: { inf_def: 6 } }],
};

function base() {
  const loadout = emptyLoadout();
  loadout.primary = "bo-binh";
  loadout.equip.chest = { slug: "giap", tier: 1, inscription: null };
  return loadout;
}

describe("computeSheet", () => {
  it("chỉ huy phụ chỉ góp một nửa", () => {
    const loadout = emptyLoadout();
    loadout.primary = "bo-binh";
    loadout.secondary = "ky-binh";
    const sheet = computeSheet(DATA, loadout);
    expect(sheet.byKey.inf_atk.total).toBe(10 + 4 * SECONDARY_SCALE);
  });

  it("cộng tài năng đặc biệt khi loại quân của chỉ huy chính khớp", () => {
    const sheet = computeSheet(DATA, base());
    expect(sheet.byKey.inf_def.total).toBe(13);
  });

  it("chỉ huy khác loại quân thì không cộng tài năng đặc biệt", () => {
    const loadout = base();
    loadout.primary = "ky-binh";
    expect(computeSheet(DATA, loadout).byKey.inf_def.total).toBe(10);
  });

  it("biểu trưng có điều kiện nằm riêng, không lẫn vào tổng", () => {
    const loadout = base();
    loadout.equip.chest.tier = 2;
    const sheet = computeSheet(DATA, loadout);
    expect(sheet.byKey.counter_damage.total).toBe(0);
    expect(sheet.byKey.counter_damage.conditionalTotal).toBe(4);
  });

  it("biểu trưng chưa mở thì chưa góp gì", () => {
    const sheet = computeSheet(DATA, base());
    expect(sheet.byKey.counter_damage).toBeUndefined();
  });

  it("minh văn và đội hình đều được tính", () => {
    const loadout = base();
    loadout.equip.chest.inscription = "khac";
    loadout.formation = "gong-kim";
    const sheet = computeSheet(DATA, loadout);
    expect(sheet.byKey.inf_def.total).toBe(13 + 6);
    expect(sheet.byKey.skill_damage.total).toBe(2 + 3);
  });

  it("tài năng đặc biệt KHÔNG nhân vào khối biểu trưng", () => {
    // Câu trong game ("thiết bị thuộc tính này được tăng 30%") không nói rõ có
    // nhân cả khối Biểu Trưng hay không. Chưa ai xác nhận, nên không đoán rộng
    // ra — đoán rộng làm mọi con số cao hơn thực tế mà không ai biết.
    // Đây là bài test khoá lại lựa chọn đó: đổi hành vi thì phải đổi cả test.
    const sheet = computeSheet(DATA, base());
    expect(sheet.byKey.inf_def.total).toBe(13);        // 10 x 1,3 — chỉ số nền CÓ nhân
    expect(sheet.byKey.skill_damage.total).toBe(2);    // biểu trưng I KHÔNG nhân
  });

  it("hai ô phụ kiện nhận hai món khác nhau cùng loại ô", () => {
    const loadout = emptyLoadout();
    loadout.equip.acc1 = { slug: "nhan-a", tier: 1, inscription: null };
    loadout.equip.acc2 = { slug: "nhan-b", tier: 1, inscription: null };
    const sheet = computeSheet(DATA, loadout);
    expect(sheet.byKey.inf_atk.total).toBe(5);
    expect(sheet.byKey.inf_atk.contributions).toHaveLength(2);
  });

  it("mỗi dòng giữ được danh sách nguồn để bấm ra xem", () => {
    const loadout = base();
    loadout.formation = "gong-kim";
    const labels = computeSheet(DATA, loadout).byKey.inf_def.contributions.map((c) => c.source.label);
    expect(labels.some((l) => l.includes("tài năng đặc biệt"))).toBe(true);
    expect(labels.some((l) => l.includes("đội hình"))).toBe(true);
  });

  it("có tám vị trí, hai trong số đó là phụ kiện", () => {
    expect(POSITIONS).toHaveLength(8);
    expect(POSITIONS.filter((p) => p.startsWith("acc"))).toHaveLength(2);
  });
});

describe("skillSegments", () => {
  const skill = {
    text: "Gây {1} sát thương và giảm {2} sát thương nhận.",
    values: [["300", "350", "400", "450", "550"], ["10%", "13%", "16%", "20%", "25%"]],
  };

  it("điền số theo đúng cấp đang chọn", () => {
    expect(skillSegments(skill, 1).filter((p) => p.isValue).map((p) => p.text)).toEqual(["300", "10%"]);
    expect(skillSegments(skill, 5).filter((p) => p.isValue).map((p) => p.text)).toEqual(["550", "25%"]);
  });

  it("kẹp cấp ngoài khung thay vì trả về undefined", () => {
    expect(skillSegments(skill, 9).filter((p) => p.isValue).map((p) => p.text)).toEqual(["550", "25%"]);
    expect(skillSegments(skill, 0).filter((p) => p.isValue).map((p) => p.text)).toEqual(["300", "10%"]);
  });

  it("thiếu dãy giá trị thì giữ nguyên chỗ trống chứ không nuốt im lặng", () => {
    const parts = skillSegments({ text: "Tăng {1} và {2}.", values: [["5%"]] }, 1);
    expect(parts.map((p) => p.text).join("")).toContain("{2}");
  });

  it("giữ nguyên câu khi không có chỗ trống nào", () => {
    const parts = skillSegments({ text: "Không có số.", values: [] }, 3);
    expect(parts.map((p) => p.text).join("")).toBe("Không có số.");
  });
});

describe("estimatePower", () => {
  it("build rỗng thì bằng 0", () => {
    expect(estimatePower(computeSheet(DATA, emptyLoadout()))).toBe(0);
  });

  it("lắp thêm đồ thì tăng", () => {
    const empty = estimatePower(computeSheet(DATA, emptyLoadout()));
    expect(estimatePower(computeSheet(DATA, base()))).toBeGreaterThan(empty);
  });
});
