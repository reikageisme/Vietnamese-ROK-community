import {
  VERIFICATION_ORDER,
  type Contribution,
  type StatDefinition,
  type StatLine,
  type StatSheet,
  type Verification,
} from "./types";

/** Cắt nhiễu dấu phẩy động. 1.05 * 1.03 cho 8.149999999999999, không phải 8.15. */
function tidy(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function weaker(a: Verification, b: Verification): Verification {
  return VERIFICATION_ORDER.indexOf(a) <= VERIFICATION_ORDER.indexOf(b) ? a : b;
}

/** Gộp phần trăm theo kiểu nhân dồn: 5% và 3% ra 8,15% chứ không phải 8%. */
function combineMultiplicative(values: number[]): number {
  return (values.reduce((acc, value) => acc * (1 + value / 100), 1) - 1) * 100;
}

/**
 * Gộp mọi đóng góp thành một bảng chỉ số.
 *
 * Ba điều bộ tính này KHÔNG làm, và đều là cố ý:
 *
 *  - Không đoán chỉ số lạ. Khoá không có trong từ điển thì bị bỏ và ghi cảnh
 *    báo. Gộp một chỉ số mà không biết quy tắc gộp của nó thì kết quả sai một
 *    cách âm thầm, tệ hơn là thiếu.
 *  - Không trộn phần có điều kiện vào tổng. Talent "khi tấn công thành" không
 *    phải lúc nào cũng bật, cộng thẳng vào là nói dối người dùng.
 *  - Không giấu độ tin cậy. Một dòng chỉ số chỉ đáng tin bằng nguồn yếu nhất
 *    của nó, và con số đó đi thẳng ra giao diện.
 */
export function aggregate(
  definitions: StatDefinition[],
  contributions: Contribution[],
): StatSheet {
  const dictionary = new Map(definitions.map((definition) => [definition.key, definition]));
  const grouped = new Map<string, Contribution[]>();
  const warnings: string[] = [];
  const unknownKeys = new Set<string>();

  for (const contribution of contributions) {
    if (!Number.isFinite(contribution.value)) {
      warnings.push(
        `Bỏ qua giá trị không hợp lệ cho "${contribution.statKey}" từ ${contribution.source.label}.`,
      );
      continue;
    }
    if (!dictionary.has(contribution.statKey)) {
      unknownKeys.add(contribution.statKey);
      continue;
    }
    const bucket = grouped.get(contribution.statKey);
    if (bucket) bucket.push(contribution);
    else grouped.set(contribution.statKey, [contribution]);
  }

  for (const key of [...unknownKeys].sort()) {
    warnings.push(`Chỉ số "${key}" chưa có trong từ điển nên bị bỏ qua.`);
  }

  const lines: StatLine[] = [];

  for (const [key, items] of grouped) {
    const definition = dictionary.get(key)!;
    let stackRule = definition.stackRule;

    // Nhân dồn chỉ có nghĩa với phần trăm. Cộng thẳng mà khai nhân dồn là lỗi
    // cấu hình — nói ra rồi hạ về cộng dồn, chứ không tính ra một số vô nghĩa.
    if (stackRule === "MULTIPLICATIVE" && definition.kind === "FLAT") {
      warnings.push(
        `"${key}" khai nhân dồn nhưng là chỉ số cộng thẳng; tạm gộp bằng cộng dồn.`,
      );
      stackRule = "ADDITIVE";
    }

    const always = items.filter((item) => !item.source.conditional);
    const conditional = items.filter((item) => item.source.conditional);

    const fold = (list: Contribution[]): number => {
      if (list.length === 0) return 0;
      const values = list.map((item) => item.value);
      if (stackRule === "MAX_ONLY") return Math.max(...values);
      if (stackRule === "MULTIPLICATIVE") return combineMultiplicative(values);
      return values.reduce((sum, value) => sum + value, 0);
    };

    const verification = items.reduce<Verification>(
      (worst, item) => weaker(worst, item.source.verification),
      "CONFIRMED",
    );

    lines.push({
      key,
      kind: definition.kind,
      group: definition.group,
      stackRule,
      total: tidy(fold(always)),
      conditionalTotal: tidy(fold(conditional)),
      contributions: items,
      verification,
    });
  }

  lines.sort((a, b) => {
    const left = dictionary.get(a.key)!;
    const right = dictionary.get(b.key)!;
    if (left.group !== right.group) return left.group.localeCompare(right.group);
    const order = (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
    return order !== 0 ? order : a.key.localeCompare(b.key);
  });

  const seen = new Set<string>();
  const unverifiedSources = contributions
    .map((contribution) => contribution.source)
    .filter((source) => {
      if (source.verification !== "UNVERIFIED") return false;
      const id = `${source.kind}:${source.id}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

  return {
    lines,
    byKey: Object.fromEntries(lines.map((line) => [line.key, line])),
    warnings,
    unverifiedSources,
  };
}

/**
 * Chênh lệch giữa hai bảng chỉ số — dùng cho nút So sánh và cho phản hồi tức thì
 * khi người dùng đổi một bậc trang bị.
 */
export function diffSheets(
  before: StatSheet,
  after: StatSheet,
): { key: string; before: number; after: number; delta: number }[] {
  const keys = new Set([...Object.keys(before.byKey), ...Object.keys(after.byKey)]);
  const rows = [...keys].map((key) => {
    const left = before.byKey[key]?.total ?? 0;
    const right = after.byKey[key]?.total ?? 0;
    return { key, before: left, after: right, delta: tidy(right - left) };
  });
  return rows.filter((row) => row.delta !== 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/** Đổi bản đồ `stats` trong cơ sở dữ liệu thành danh sách đóng góp. */
export function contributionsFrom(
  stats: Record<string, unknown>,
  source: Contribution["source"],
): Contribution[] {
  return Object.entries(stats)
    .filter(([, value]) => typeof value === "number")
    .map(([statKey, value]) => ({ statKey, value: value as number, source }));
}
