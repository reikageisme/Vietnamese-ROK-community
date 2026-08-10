import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { forumError } from "@/modules/forum/http";
import { entityIdSchema } from "@/modules/forum/schemas";

const DEBOUNCE_SECONDS = 10 * 60;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = entityIdSchema.parse((await context.params).id); const jar = await cookies(); const key = `rv_view_${id.slice(-20)}`; const previous = Number(jar.get(key)?.value ?? 0); const now = Math.floor(Date.now() / 1000);
    if (now - previous < DEBOUNCE_SECONDS) return Response.json({ counted: false });
    const updated = await prisma.topic.updateMany({ where: { id, deletedAt: null }, data: { viewCount: { increment: 1 } } });
    if (!updated.count) return Response.json({ error: "Không tìm thấy chủ đề." }, { status: 404 });
    const response = Response.json({ counted: true });
    response.headers.append("Set-Cookie", `${key}=${now}; Path=/; Max-Age=${DEBOUNCE_SECONDS}; HttpOnly; SameSite=Lax`);
    return response;
  } catch (error) { return forumError(error); }
}
