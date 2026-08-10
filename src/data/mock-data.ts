import type { Locale } from "@/i18n/provider";

export type Localized = Record<Locale, string>;

export const forumCategories = [
  { slug: "nguoi-choi-moi", icon: "01", name: { vi: "Người chơi mới", en: "New players" }, description: { vi: "Bắt đầu đúng hướng, phát triển tài khoản và tránh lãng phí tài nguyên.", en: "Start well, grow efficiently, and avoid wasting resources." }, topics: 128, activity: "12 phút" },
  { slug: "commander-pairing", icon: "02", name: { vi: "Chỉ huy & Ghép cặp", en: "Commanders & Pairing" }, description: { vi: "Thảo luận đội hình, kỹ năng và cách đầu tư theo từng giai đoạn.", en: "Discuss lineups, skills, and investment by progression stage." }, topics: 246, activity: "25 phút" },
  { slug: "equipment", icon: "03", name: { vi: "Trang bị", en: "Equipment" }, description: { vi: "Lộ trình chế tạo, lựa chọn chỉ số và tối ưu bộ trang bị.", en: "Crafting paths, stat choices, and equipment optimization." }, topics: 84, activity: "1 giờ" },
  { slug: "kvk", icon: "04", name: { vi: "Chiến thuật KvK", en: "KvK Strategy" }, description: { vi: "Kinh nghiệm giao tranh, quản trị tài nguyên và phối hợp liên minh.", en: "Field tactics, resource planning, and alliance coordination." }, topics: 193, activity: "8 phút" },
  { slug: "alliance", icon: "05", name: { vi: "Quản lý liên minh", en: "Alliance Management" }, description: { vi: "Công cụ và kinh nghiệm dành cho R4/R5.", en: "Practical operations for R4 and R5 leaders." }, topics: 67, activity: "3 giờ" },
  { slug: "migration", icon: "06", name: { vi: "Di cư & Tuyển quân", en: "Migration & Recruitment" }, description: { vi: "Tìm kingdom phù hợp, đăng tuyển minh bạch và chuẩn bị hộ chiếu.", en: "Find the right kingdom, recruit transparently, and plan passports." }, topics: 159, activity: "40 phút" },
  { slug: "events", icon: "07", name: { vi: "Sự kiện", en: "Events" }, description: { vi: "Lịch sự kiện, cách chuẩn bị và chia sẻ kết quả.", en: "Event schedules, preparation, and shared results." }, topics: 72, activity: "5 giờ" },
  { slug: "feedback", icon: "08", name: { vi: "Góp ý & Báo lỗi", en: "Feedback & Bugs" }, description: { vi: "Cùng cải thiện RokViet Hub qua từng phiên bản.", en: "Help improve RokViet Hub with every release." }, topics: 21, activity: "1 ngày" }
];

export const featuredPosts = [
  { category: { vi: "Người chơi mới", en: "New players" }, title: { vi: "Lộ trình 30 ngày đầu cho tài khoản không nạp", en: "A practical first 30 days for free-to-play accounts" }, summary: { vi: "Các mốc phát triển đáng ưu tiên và những sai lầm tốn thời gian nhất.", en: "The progression milestones that matter and costly mistakes to avoid." }, author: "Minh Khang", time: "6 phút" },
  { category: { vi: "Chiến thuật KvK", en: "KvK Strategy" }, title: { vi: "Chuẩn bị tài nguyên trước KvK: checklist cho từng vai trò", en: "Pre-KvK resource checklist for every role" }, summary: { vi: "Một cách chia ngân sách tăng tốc, tài nguyên và AP dễ áp dụng.", en: "A simple framework for speedups, resources, and AP budgeting." }, author: "Hana K27", time: "9 phút" }
];

export const discussions = [
  { title: { vi: "Nên ưu tiên một đội hình thật mạnh hay hai đội hình cân bằng?", en: "One very strong march or two balanced marches?" }, category: { vi: "Chỉ huy", en: "Commanders" }, replies: 28, updated: "9 phút" },
  { title: { vi: "Cách tổ chức đăng ký MGE minh bạch cho kingdom", en: "A transparent MGE registration workflow for kingdoms" }, category: { vi: "Quản lý", en: "Leadership" }, replies: 17, updated: "31 phút" },
  { title: { vi: "Kinh nghiệm chọn kingdom trước khi di cư", en: "What to check before migrating to a kingdom" }, category: { vi: "Di cư", en: "Migration" }, replies: 42, updated: "1 giờ" }
];

export const codexEntries = [
  { type: "commander", initials: "KB", name: { vi: "Kỵ binh tiên phong", en: "Cavalry Vanguard" }, role: { vi: "Dã chiến · Cơ động", en: "Open field · Mobility" }, season: "SoC", updated: "07/08/2026" },
  { type: "commander", initials: "BB", name: { vi: "Bộ binh phòng thủ", en: "Infantry Defender" }, role: { vi: "Đồn trú · Phòng thủ", en: "Garrison · Defense" }, season: "SoC", updated: "05/08/2026" },
  { type: "commander", initials: "CT", name: { vi: "Cung thủ chiến thuật", en: "Archer Tactician" }, role: { vi: "Dã chiến · Kỹ năng", en: "Open field · Skill" }, season: "KvK 3", updated: "01/08/2026" },
  { type: "equipment", initials: "VK", name: { vi: "Vũ khí kỵ binh mẫu", en: "Sample cavalry weapon" }, role: { vi: "Tấn công · Kỵ binh", en: "Attack · Cavalry" }, season: "Legendary", updated: "29/07/2026" },
  { type: "equipment", initials: "GK", name: { vi: "Giáp khiên mẫu", en: "Sample shield armor" }, role: { vi: "Phòng thủ · Bộ binh", en: "Defense · Infantry" }, season: "Epic", updated: "28/07/2026" }
];

export const tools = [
  { slug: "speedup", mark: "24h", name: { vi: "Tăng tốc", en: "Speedups" }, description: { vi: "Quy đổi vật phẩm tăng tốc thành tổng thời gian.", en: "Convert speedup items into a clear total." }, available: true },
  { slug: "resources", mark: "R", name: { vi: "Tài nguyên", en: "Resources" }, description: { vi: "Tổng hợp gói tài nguyên và mục tiêu cần đạt.", en: "Total resource packs against your target." }, available: false },
  { slug: "healing", mark: "+", name: { vi: "Hồi phục", en: "Healing" }, description: { vi: "Ước tính tài nguyên và thời gian hồi phục.", en: "Estimate healing time and resource costs." }, available: false },
  { slug: "sculpture", mark: "S", name: { vi: "Tượng chỉ huy", en: "Sculptures" }, description: { vi: "Lập kế hoạch nâng kỹ năng chỉ huy.", en: "Plan commander skill upgrades." }, available: false },
  { slug: "equipment", mark: "E", name: { vi: "Chế tạo trang bị", en: "Equipment crafting" }, description: { vi: "Tính vật liệu còn thiếu cho kế hoạch chế tạo.", en: "Calculate missing materials for a crafting plan." }, available: false },
  { slug: "passport", mark: "P", name: { vi: "Hộ chiếu di cư", en: "Migration passports" }, description: { vi: "Ước tính số trang hộ chiếu theo sức mạnh.", en: "Estimate passport pages by power." }, available: false }
];
