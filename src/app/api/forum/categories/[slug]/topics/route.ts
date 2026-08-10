import { prisma } from "@/lib/prisma";
import { forumError } from "@/modules/forum/http";
import { listTopicsSchema } from "@/modules/forum/schemas";

const PAGE_SIZE = 20;

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const query = listTopicsSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const category = await prisma.category.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: { select: { translations: true } } },
    });
    if (!category) return Response.json({ error: "Không tìm thấy chuyên mục." }, { status: 404 });
    const where = { categoryId: category.id, deletedAt: null, status: "PUBLISHED" as const };
    const [total, topics] = await prisma.$transaction([
      prisma.topic.count({ where }),
      prisma.topic.findMany({
        where,
        skip: (query.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        orderBy: query.sort === "top" ? [{ isPinned: "desc" }, { upvoteCount: "desc" }, { downvoteCount: "asc" }, { updatedAt: "desc" }] : [{ isPinned: "desc" }, { lastReplyAt: "desc" }, { updatedAt: "desc" }],
        include: {
          author: { select: { id: true, displayName: true, name: true, image: true } },
          tags: { include: { tag: { select: { slug: true } } } },
        },
      }),
    ]);
    return Response.json({
      category: {
        id: category.id,
        slug: category.slug,
        name: Object.fromEntries(category.name.translations.map((item) => [item.locale, item.value])),
      },
      page: query.page, pageSize: PAGE_SIZE, total, pages: Math.ceil(total / PAGE_SIZE),
      topics: topics.map((topic) => ({ ...topic, score: topic.upvoteCount - topic.downvoteCount, tags: topic.tags.map((item) => ({ slug: item.tag.slug, isVerified: item.isVerifiedTag })) })),
    });
  } catch (error) { return forumError(error); }
}
