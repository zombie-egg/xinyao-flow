import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, fail, apiError } from "@/lib/api";
import { z } from "zod";

const schema = z.object({ collaboratorIds: z.array(z.string().min(1)).max(20) });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return fail("协同销售选择无效", "VALIDATION_ERROR");
    const customer = await db.customer.findUnique({ where: { id } });
    if (!customer) return fail("客户不存在", "NOT_FOUND", 404);
    const canEdit =
      customer.ownerId === user.id ||
      user.role.code === "SALES_MANAGER" ||
      user.role.code === "ADMIN";
    if (!canEdit) throw new Error("FORBIDDEN");
    const collaboratorIds = [...new Set(parsed.data.collaboratorIds)].filter(
      (userId) => userId !== customer.ownerId,
    );
    if (collaboratorIds.length) {
      const count = await db.user.count({
        where: {
          id: { in: collaboratorIds },
          status: "ACTIVE",
          role: { code: { in: ["SALES_MANAGER", "SALES_EMPLOYEE"] } },
        },
      });
      if (count !== collaboratorIds.length)
        return fail("协同销售不存在或已停用", "INVALID_COLLABORATOR");
    }
    await db.$transaction(async (tx) => {
      await tx.customerCollaborator.deleteMany({ where: { customerId: id } });
      if (collaboratorIds.length)
        await tx.customerCollaborator.createMany({
          data: collaboratorIds.map((userId) => ({ customerId: id, userId })),
        });
      await tx.operationLog.create({
        data: {
          userId: user.id,
          action: "UPDATE_CUSTOMER_COLLABORATORS",
          module: "CUSTOMER",
          targetId: id,
          description: `更新客户“${customer.name}”的协同销售`,
        },
      });
    });
    return ok({ customerId: id, collaboratorIds });
  } catch (error) {
    return apiError(error);
  }
}
