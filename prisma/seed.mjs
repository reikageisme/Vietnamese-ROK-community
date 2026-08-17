import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const prisma = new PrismaClient();
const categories = [
  ["nguoi-choi-moi", "Người chơi mới", "New players", "Bắt đầu đúng hướng và tránh lãng phí tài nguyên."],
  ["commander-pairing", "Chỉ huy & Ghép cặp", "Commanders & Pairing", "Thảo luận đội hình, kỹ năng và cách đầu tư."],
  ["equipment", "Trang bị", "Equipment", "Lộ trình chế tạo và tối ưu trang bị."],
  ["kvk", "Chiến thuật KvK", "KvK Strategy", "Kinh nghiệm giao tranh và phối hợp liên minh."],
  ["alliance", "Quản lý liên minh", "Alliance Management", "Công cụ và kinh nghiệm dành cho R4/R5."],
  ["migration", "Di cư & Tuyển quân", "Migration & Recruitment", "Tìm kingdom phù hợp và chuẩn bị hộ chiếu."],
  ["events", "Sự kiện", "Events", "Lịch sự kiện và cách chuẩn bị."],
  ["feedback", "Góp ý & Báo lỗi", "Feedback & Bugs", "Cùng cải thiện RokViet Hub."],
];

for (const [index, [slug, vi, en, description]] of categories.entries()) {
  const nameKey = `forum.category.${slug}.name`; const descriptionKey = `forum.category.${slug}.description`;
  await prisma.i18nMessage.upsert({ where: { key: nameKey }, update: {}, create: { key: nameKey } });
  await prisma.i18nMessage.upsert({ where: { key: descriptionKey }, update: {}, create: { key: descriptionKey } });
  for (const [messageId, locale, value] of [[nameKey, "vi", vi], [nameKey, "en", en], [descriptionKey, "vi", description], [descriptionKey, "en", description]]) {
    await prisma.i18nTranslation.upsert({ where: { messageId_locale: { messageId, locale } }, update: { value }, create: { messageId, locale, value } });
  }
  await prisma.category.upsert({ where: { slug }, update: { sortOrder: index, isActive: true }, create: { slug, nameKey, descriptionKey, sortOrder: index } });
}

const demoKingdoms = [
  [2812, "Vương quốc Selmes", "A", 1], [3104, "Thành trì Rồng Việt", "A", 2],
  [3377, "Bình minh Phương Nam", "B", 3], [2926, "Liên minh Cửu Long", "B", 4],
  [3441, "Đế chế Tràng An", "C", 5], [3058, "Hội tụ Đông Dương", "C", 6],
  [3265, "Ngọn giáo Sparta", "D", 7], [3189, "Biển Đông", "D", 8],
];
const campaign = await prisma.kvkCampaign.upsert({
  where: { code: "C13273" },
  update: { name: "Song of Troy", status: "ACTIVE" },
  create: { code: "C13273", name: "Song of Troy", mapName: "Lost Kingdom", status: "ACTIVE", startsAt: new Date("2026-07-31T00:00:00Z"), endsAt: new Date("2026-09-21T00:00:00Z") },
});
const campDefinitions = { A: ["Dardania", "#fb416f"], B: ["Lycia", "#f7c94b"], C: ["Mycenae", "#3dd6a3"], D: ["Aeolia", "#4d8dff"] };
for (const [number, name, campCode, seed] of demoKingdoms) {
  const kingdom = await prisma.kingdom.upsert({ where: { number }, update: { name }, create: { number, name } });
  const [campName, color] = campDefinitions[campCode];
  const camp = await prisma.kvkCamp.upsert({ where: { campaignId_code: { campaignId: campaign.id, code: campCode } }, update: { name: campName, color }, create: { campaignId: campaign.id, code: campCode, name: campName, color } });
  await prisma.kvkCampKingdom.upsert({ where: { campId_kingdomId: { campId: camp.id, kingdomId: kingdom.id } }, update: { seed }, create: { campId: camp.id, kingdomId: kingdom.id, seed } });
}

if (process.env.SEED_DEMO_ACCOUNTS === "true") {
  const passwordOptions = { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 };
  const memberPassword = process.env.DEMO_MEMBER_PASSWORD ?? "RokVietDemo!2026";
  const moderatorPassword = process.env.DEMO_MODERATOR_PASSWORD ?? "RokVietMod!2026";
  const memberHash = await hash(memberPassword, passwordOptions);
  const moderatorHash = await hash(moderatorPassword, passwordOptions);
  const member = await prisma.user.upsert({
    where: { email: "demo.member@rokviet.local" },
    update: { name: "Thành viên Demo", displayName: "Thành viên Demo", passwordHash: memberHash, emailVerified: new Date(), isActive: true, loginMethods: ["credentials"] },
    create: { email: "demo.member@rokviet.local", name: "Thành viên Demo", displayName: "Thành viên Demo", passwordHash: memberHash, emailVerified: new Date(), isActive: true, loginMethods: ["credentials"] },
  });
  const moderator = await prisma.user.upsert({
    where: { email: "demo.mod@rokviet.local" },
    update: { name: "Điều hành Demo", displayName: "Điều hành Demo", passwordHash: moderatorHash, emailVerified: new Date(), isActive: true, loginMethods: ["credentials"] },
    create: { email: "demo.mod@rokviet.local", name: "Điều hành Demo", displayName: "Điều hành Demo", passwordHash: moderatorHash, emailVerified: new Date(), isActive: true, loginMethods: ["credentials"] },
  });
  for (const [userId, roles] of [[member.id, ["MEMBER"]], [moderator.id, ["MEMBER", "MODERATOR"]]]) {
    for (const role of roles) await prisma.userRole.upsert({ where: { userId_role: { userId, role } }, update: {}, create: { userId, role } });
  }

  const kvkCategory = await prisma.category.findUniqueOrThrow({ where: { slug: "kvk" } });
  const beginnerCategory = await prisma.category.findUniqueOrThrow({ where: { slug: "nguoi-choi-moi" } });
  const topicOne = await prisma.topic.upsert({
    where: { slug: "demo-checklist-chuan-bi-kvk" },
    update: { authorId: moderator.id, categoryId: kvkCategory.id },
    create: { id: "demo-topic-kvk", slug: "demo-checklist-chuan-bi-kvk", categoryId: kvkCategory.id, authorId: moderator.id, title: "Checklist chuẩn bị trước KvK cho cả kingdom", body: "Mình tổng hợp checklist cho R4/R5: lịch buff, kho tài nguyên, đăng ký rally/garrison và quy trình cập nhật dữ liệu. Đây là bài demo để thử trả lời, bình chọn, bookmark và báo cáo.", bodyHtml: "", isPinned: true, viewCount: 128, upvoteCount: 12 },
  });
  await prisma.reply.upsert({ where: { id: "demo-reply-kvk" }, update: { authorId: member.id }, create: { id: "demo-reply-kvk", topicId: topicOne.id, authorId: member.id, body: "Phần chia khung giờ rally rất hữu ích. Nên bổ sung thêm cột người thay thế khi rally leader mất kết nối.", bodyHtml: "", upvoteCount: 4 } });
  await prisma.topic.update({ where: { id: topicOne.id }, data: { replyCount: 1, lastReplyById: member.id, lastReplyAt: new Date() } });
  await prisma.category.update({ where: { id: kvkCategory.id }, data: { topicCount: 1, lastActivityAt: new Date() } });

  await prisma.topic.upsert({
    where: { slug: "demo-lo-trinh-30-ngay-f2p" },
    update: { authorId: member.id, categoryId: beginnerCategory.id },
    create: { id: "demo-topic-f2p", slug: "demo-lo-trinh-30-ngay-f2p", categoryId: beginnerCategory.id, authorId: member.id, title: "Lộ trình 30 ngày đầu cho tài khoản F2P", body: "Một lộ trình thực tế để thử nghiệm forum: ưu tiên công nghệ, commander, AP và tăng tốc. Mọi người có thể reply bằng Markdown và bình chọn nội dung hữu ích.", bodyHtml: "", viewCount: 86, upvoteCount: 8 },
  });
  await prisma.category.update({ where: { id: beginnerCategory.id }, data: { topicCount: 1, lastActivityAt: new Date() } });

  console.log("Demo member: demo.member@rokviet.local /", memberPassword);
  console.log("Demo moderator: demo.mod@rokviet.local /", moderatorPassword);
}

await prisma.$disconnect();
