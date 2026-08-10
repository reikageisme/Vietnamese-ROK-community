import { PrismaClient } from "@prisma/client";

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

await prisma.$disconnect();
