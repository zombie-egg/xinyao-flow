import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { z } from "zod";

const schema = z.object({
  ownerId: z.string().min(1, "请选择负责销售"),
  collaboratorIds: z.array(z.string().min(1)).max(20).default([]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (!user.role.code.startsWith("SALES")) throw new Error("FORBIDDEN");
    const { id } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success)
      return fail(parsed.error.issues[0].message, "VALIDATION_ERROR");
    const collaboratorIds = [...new Set(parsed.data.collaboratorIds)].filter(
      (userId) => userId !== parsed.data.ownerId,
    );
    const selectedIds = [parsed.data.ownerId, ...collaboratorIds];
    const salesCount = await db.user.count({
      where: {
        id: { in: selectedIds },
        status: "ACTIVE",
        role: { code: { in: ["SALES_MANAGER", "SALES_EMPLOYEE"] } },
      },
    });
    if (salesCount !== selectedIds.length)
      return fail("负责销售或协同跟进人不存在或已停用", "INVALID_SALES_USER", 400);

    const updated = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Customer" WHERE id=${id} FOR UPDATE`;
      const current = await tx.customer.findUnique({ where: { id } });
      if (!current) throw new Error("NOT_FOUND");
      if (!current.isPublicPool || current.ownerId) throw new Error("ALREADY_CLAIMED");
      const customer = await tx.customer.update({
        where: { id },
        data: {
          isPublicPool: false,
          ownerId: parsed.data.ownerId,
          status: "POTENTIAL",
          collaborators: {
            deleteMany: {},
            create: collaboratorIds.map((userId) => ({ userId })),
          },
        },
      });
      await tx.operationLog.create({
        data: {
          userId: user.id,
          action: "CLAIM_PUBLIC_CUSTOMER",
          module: "CUSTOMER",
          targetId: id,
          description: `认领公海客户：${customer.name}`,
        },
      });
      return customer;
    });
    return ok(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND")
      return fail("客户不存在", "NOT_FOUND", 404);
    if (error instanceof Error && error.message === "ALREADY_CLAIMED")
      return fail("该客户已被其他销售认领", "ALREADY_CLAIMED", 409);
    return apiError(error);
  }
}
