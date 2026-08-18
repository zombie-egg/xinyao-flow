import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { customerBusinessAccess, hasSalesCapabilities } from "@/lib/customer-access";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (!hasSalesCapabilities(user.role.code)) throw new Error("FORBIDDEN");
    const { id } = await params;
    const updated = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Customer" WHERE id=${id} FOR UPDATE`;
      const current = await tx.customer.findUnique({
        where: { id },
        include: { collaborators: { select: { userId: true } } },
      });
      if (!current) throw new Error("NOT_FOUND");
      if (current.isPublicPool || !current.ownerId) throw new Error("ALREADY_PUBLIC");
      const canRelease = customerBusinessAccess(current, user.id);
      if (!canRelease) throw new Error("FORBIDDEN");
      const customer = await tx.customer.update({
        where: { id },
        data: {
          isPublicPool: true,
          ownerId: null,
          pendingOwnerName: null,
          status: "POTENTIAL",
          collaborators: { deleteMany: {} },
        },
      });
      await tx.operationLog.create({
        data: {
          userId: user.id,
          action: "RELEASE_CUSTOMER_TO_PUBLIC_POOL",
          module: "CUSTOMER",
          targetId: id,
          description: `客户负责人或协同人放入公海池：${customer.name}`,
        },
      });
      return customer;
    });
    return ok(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND")
      return fail("客户不存在", "NOT_FOUND", 404);
    if (error instanceof Error && error.message === "ALREADY_PUBLIC")
      return fail("该客户已经在公海池", "ALREADY_PUBLIC", 409);
    return apiError(error);
  }
}
