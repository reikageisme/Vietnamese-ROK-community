import type { PrismaClient, Prisma } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export async function replaceTopicTags(db: Db, topicId: string, rawTags: string[]) {
  const tags = [...new Set(rawTags.map((value) => value.toLowerCase()))];
  await db.topicTag.deleteMany({ where: { topicId } });
  for (const slug of tags) {
    const commanderSlug = slug.startsWith("commander:") ? slug.slice("commander:".length) : null;
    const verified = commanderSlug
      ? Boolean(await db.commander.findUnique({ where: { slug: commanderSlug }, select: { id: true } }))
      : !slug.startsWith("commander:");
    const nameKey = `forum.tag.${slug}`;
    await db.i18nMessage.upsert({
      where: { key: nameKey },
      update: {},
      create: { key: nameKey, translations: { create: [{ locale: "vi" as const, value: slug }, { locale: "en" as const, value: slug }] } },
    });
    const tag = await db.tag.upsert({
      where: { slug },
      update: {},
      create: { slug, name: { connect: { key: nameKey } } },
    });
    await db.topicTag.create({ data: { topicId, tagId: tag.id, isVerifiedTag: verified, verifiedAt: verified ? new Date() : null } });
  }
}
