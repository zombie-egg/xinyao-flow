import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { z } from "zod";
import { customerBusinessAccess } from "@/lib/customer-access";

const schema = z.object({
  content: z.string().trim().min(1, "请填写客户流水内容").max(5000),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requirePermission("customer:view");
    const { id } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success)
      return fail(parsed.error.issues[0].message, "VALIDATION_ERROR");
    const customer = await db.customer.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        ownerId: true,
        collaborators: { select: { userId: true } },
      },
    });
    if (!customer) return fail("客户不存在", "NOT_FOUND", 404);
    if (!user.role.code.startsWith("SALES") || !customerBusinessAccess(customer, user.id))
      throw new Error("FORBIDDEN");
    const activity = await db.$transaction(async (tx) => {
      const item = await tx.customerActivity.create({
        data: { customerId: id, authorId: user.id, content: parsed.data.content },
        include: { author: { select: { name: true } } },
      });
      await tx.operationLog.create({
        data: {
          userId: user.id,
          action: "ADD_CUSTOMER_ACTIVITY",
          module: "CUSTOMER",
          targetId: id,
          description: `添加客户“${customer.name}”流水`,
        },
      });
      return item;
    });
    return ok(activity, 201);
  } catch (error) {
    return apiError(error);
  }
}
