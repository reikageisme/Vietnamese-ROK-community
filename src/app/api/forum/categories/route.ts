import { prisma } from "@/lib/prisma";
import { forumError } from "@/modules/forum/http";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { name: { include: { translations: true } }, description: { include: { translations: true } } },
    });
    return Response.json(categories.map((category) => ({
      id: category.id, slug: category.slug, order: category.sortOrder, topicCount: category.topicCount, topics: category.topicCount, icon: category.icon, lastActivityAt: category.lastActivityAt,
      name: Object.fromEntries(category.name.translations.map((item) => [item.locale, item.value])),
      description: Object.fromEntries(category.description?.translations.map((item) => [item.locale, item.value]) ?? []),
    })));
  } catch (error) { return forumError(error); }
}
