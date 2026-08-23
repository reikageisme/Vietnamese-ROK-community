import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guards";
import { forumError } from "@/modules/forum/http";

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(50),
  locale: z.enum(["vi", "en"]),
});

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const input = updateProfileSchema.parse(await request.json());
    const duplicate = await prisma.user.findFirst({
      where: { id: { not: session.user.id }, displayName: { equals: input.displayName, mode: "insensitive" } },
      select: { id: true },
    });
    if (duplicate) return Response.json({ error: "Tên hiển thị này đã được sử dụng." }, { status: 409 });
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: input,
      select: { id: true, displayName: true, locale: true },
    });
    return Response.json({ user });
  } catch (error) {
    return forumError(error);
  }
}
