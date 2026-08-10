import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const commanders = await prisma.commander.findMany({ where: q ? { slug: { contains: q, mode: "insensitive" } } : undefined, select: { slug: true }, take: 10, orderBy: { slug: "asc" } });
  return Response.json({ commanders });
}
