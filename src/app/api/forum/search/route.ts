import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { forumError } from "@/modules/forum/http";
import { searchSchema } from "@/modules/forum/schemas";
import { pageWindow, searchTerms } from "@/modules/forum/logic";

export async function GET(request: Request) {
  try {
    const input = searchSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const terms = searchTerms(input.q);
    // TODO: Move to a generated tsvector + GIN index after Vietnamese unaccent
    // configuration is standardized. MVP uses indexed filters + parameterized ILIKE.
    const where: Prisma.TopicWhereInput = {
      deletedAt: null, status: "PUBLISHED",
      ...(input.category ? { category: { slug: input.category } } : {}),
      AND: terms.map((term) => ({ OR: [{ title: { contains: term, mode: "insensitive" } }, { body: { contains: term, mode: "insensitive" } }] })),
    };
    const [total, topics] = await prisma.$transaction([
      prisma.topic.count({ where }),
      prisma.topic.findMany({ where, ...pageWindow(input.page, input.pageSize), orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }], include: { category: { select: { slug: true } }, author: { select: { id: true, displayName: true, name: true } } } }),
    ]);
    return Response.json({ q: input.q, page: input.page, pageSize: input.pageSize, total, pages: Math.ceil(total / input.pageSize), topics });
  } catch (error) { return forumError(error); }
}
