export type CampCode = "A" | "B" | "C" | "D";

export type KingdomRow = {
  number: number;
  name: string;
  camp: CampCode;
  seed: number;
  power: number;
  killPoints: number;
  deadTroops: number;
  t4Kills: number;
  t5Kills: number;
  top300: number;
  coverage: number;
  updatedAt: string;
  status: "Sẵn sàng" | "Đang quét" | "Dữ liệu cũ";
};

export type GovernorRow = {
  rank: number;
  id: string;
  name: string;
  alliance: string;
  power: number;
  killPoints: number;
  deadTroops: number;
  t4Kills: number;
  t5Kills: number;
  helps: number;
  capturedAt: string;
};

export const campMeta: Record<CampCode, { name: string; tone: string; color: string }> = {
  A: { name: "Dardania", tone: "Hỏa", color: "#fb416f" },
  B: { name: "Lycia", tone: "Quang", color: "#f7c94b" },
  C: { name: "Mycenae", tone: "Phong", color: "#3dd6a3" },
  D: { name: "Aeolia", tone: "Thủy", color: "#4d8dff" },
};

export const kingdoms: KingdomRow[] = [
  { number: 2812, name: "Vương quốc Selmes", camp: "A", seed: 1, power: 13_719_763_015, killPoints: 81_546_771_148, deadTroops: 364_202_482, t4Kills: 299_510_000, t5Kills: 1_060_000_000, top300: 300, coverage: 98, updatedAt: "17/08/2026 16:23", status: "Sẵn sàng" },
  { number: 3104, name: "Thành trì Rồng Việt", camp: "A", seed: 2, power: 12_972_288_798, killPoints: 116_792_598_004, deadTroops: 447_611_241, t4Kills: 286_420_000, t5Kills: 982_000_000, top300: 300, coverage: 96, updatedAt: "17/08/2026 15:51", status: "Sẵn sàng" },
  { number: 3377, name: "Bình minh Phương Nam", camp: "B", seed: 3, power: 12_136_177_713, killPoints: 53_595_414_254, deadTroops: 302_742_440, t4Kills: 248_610_000, t5Kills: 1_020_000_000, top300: 300, coverage: 91, updatedAt: "17/08/2026 12:05", status: "Sẵn sàng" },
  { number: 2926, name: "Liên minh Cửu Long", camp: "B", seed: 4, power: 12_110_905_013, killPoints: 59_787_256_596, deadTroops: 555_602_300, t4Kills: 239_890_000, t5Kills: 1_000_000_000, top300: 300, coverage: 87, updatedAt: "17/08/2026 10:42", status: "Đang quét" },
  { number: 3441, name: "Đế chế Tràng An", camp: "C", seed: 5, power: 12_062_203_273, killPoints: 82_628_802_571, deadTroops: 522_680_406, t4Kills: 220_440_000, t5Kills: 914_000_000, top300: 290, coverage: 82, updatedAt: "16/08/2026 22:14", status: "Dữ liệu cũ" },
  { number: 3058, name: "Hội tụ Đông Dương", camp: "C", seed: 6, power: 11_968_887_082, killPoints: 70_325_002_859, deadTroops: 401_958_102, t4Kills: 218_170_000, t5Kills: 889_000_000, top300: 299, coverage: 94, updatedAt: "17/08/2026 14:02", status: "Sẵn sàng" },
  { number: 3265, name: "Ngọn giáo Sparta", camp: "D", seed: 7, power: 11_890_744_161, killPoints: 97_027_747_821, deadTroops: 406_696_764, t4Kills: 207_430_000, t5Kills: 842_000_000, top300: 300, coverage: 89, updatedAt: "17/08/2026 09:28", status: "Sẵn sàng" },
  { number: 3189, name: "Biển Đông", camp: "D", seed: 8, power: 11_504_291_660, killPoints: 64_211_056_991, deadTroops: 381_405_220, t4Kills: 193_200_000, t5Kills: 799_000_000, top300: 287, coverage: 78, updatedAt: "16/08/2026 20:18", status: "Dữ liệu cũ" },
];

export const governors: GovernorRow[] = [
  { rank: 1, id: "124906225", name: "Boss Võ", alliance: "CS35", power: 121_030_602, killPoints: 3_623_770_839, deadTroops: 2_532_013, t4Kills: 182_341_202, t5Kills: 716_220_470, helps: 168_530, capturedAt: "16/08 08:19" },
  { rank: 2, id: "4260005", name: "MIDY Farm", alliance: "CS35", power: 96_788_057, killPoints: 19_378_471_617, deadTroops: 3_650_517, t4Kills: 1_225_601_521, t5Kills: 2_810_034_713, helps: 336_616, capturedAt: "16/08 08:19" },
  { rank: 3, id: "129794282", name: "Mrđông", alliance: "57Tp", power: 96_681_747, killPoints: 2_186_215_972, deadTroops: 2_389_712, t4Kills: 140_315_224, t5Kills: 422_053_144, helps: 60_692, capturedAt: "16/08 08:19" },
  { rank: 4, id: "32748671", name: "정보", alliance: "F812", power: 94_624_705, killPoints: 8_327_537_848, deadTroops: 7_143_000, t4Kills: 629_400_113, t5Kills: 1_104_811_992, helps: 74_522, capturedAt: "16/08 08:19" },
  { rank: 5, id: "81066191", name: "AngryCrab", alliance: "CS35", power: 94_077_650, killPoints: 4_525_166_701, deadTroops: 3_735_658, t4Kills: 388_306_220, t5Kills: 931_337_554, helps: 119_661, capturedAt: "16/08 08:19" },
  { rank: 6, id: "53708690", name: "rł MTx7", alliance: "CS35", power: 92_920_658, killPoints: 2_227_952_014, deadTroops: 4_170_872, t4Kills: 277_918_126, t5Kills: 501_226_407, helps: 66_870, capturedAt: "16/08 08:19" },
  { rank: 7, id: "44586290", name: "rł Kenny", alliance: "CS35", power: 92_593_709, killPoints: 4_299_617_266, deadTroops: 3_911_707, t4Kills: 303_018_762, t5Kills: 770_380_131, helps: 56_800, capturedAt: "16/08 08:19" },
  { rank: 8, id: "168698603", name: "July212", alliance: "CS35", power: 91_417_681, killPoints: 3_638_708_640, deadTroops: 3_886_560, t4Kills: 244_770_911, t5Kills: 680_311_405, helps: 83_963, capturedAt: "16/08 08:19" },
];

export const scanRuns = [
  { id: "scan_2812_20260817_1623", device: "phone01", kingdom: 2812, rows: 300, images: 1214, status: "Đã duyệt", duration: "01:42:18", createdAt: "17/08/2026 16:23" },
  { id: "scan_3104_20260817_1551", device: "phone02", kingdom: 3104, rows: 300, images: 1196, status: "Chờ kiểm tra", duration: "01:39:04", createdAt: "17/08/2026 15:51" },
  { id: "scan_2926_20260817_1042", device: "phone01", kingdom: 2926, rows: 184, images: 742, status: "Đang xử lý", duration: "00:58:45", createdAt: "17/08/2026 10:42" },
];

export const kvkTimeline = [
  { name: "Crusader Camp", subtitle: "Mở bản đồ", state: "done", date: "31/07" },
  { name: "Crusader Fortress", subtitle: "Tìm chỗ đứng", state: "done", date: "03/08" },
  { name: "Ancient Ruins", subtitle: "Tranh chấp tàn tích", state: "active", date: "17/08" },
  { name: "Altar of Darkness", subtitle: "Chiếm giữ", state: "next", date: "24/08" },
  { name: "Kingsland", subtitle: "Trận chiến cuối", state: "next", date: "08/09" },
];

export function formatCompact(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

export function formatInteger(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}
