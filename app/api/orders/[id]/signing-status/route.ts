import { hasSalesCapabilities } from "@/lib/customer-access";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, fail, apiError } from "@/lib/api";

const schema = z.object({
  signingStatus: z.enum(["SIGNED", "PENDING_SIGNATURE"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (!hasSalesCapabilities(user.role.code)) throw new Error("FORBIDDEN");
    const { id } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return fail("请选择正确的合同状态", "VALIDATION_ERROR");
    const order = await db.order.findUnique({
      where: { id },
      include: { contract: true },
    });
    if (!order) return fail("订单不存在", "NOT_FOUND", 404);
    if (order.historicalSalesName)
      return fail("离职人员历史订单仅用于查询和统计", "HISTORICAL_ORDER_READ_ONLY", 409);
    const allowed =
      order.salesUserId === user.id ||
      order.contract.responsibleUserId === user.id ||
      order.contract.signerId === user.id;
    if (!allowed) throw new Error("FORBIDDEN");
    const updated = await db.$transaction(async (tx) => {
      const contract = await tx.contract.update({
        where: { id: order.contractId },
        data: { signingStatus: parsed.data.signingStatus },
      });
      await tx.operationLog.create({
        data: {
          userId: user.id,
          action: "UPDATE_CONTRACT_SIGNING_STATUS",
          module: "ORDER",
          targetId: id,
          description: `将合同状态修改为${contract.signingStatus === "SIGNED" ? "已签署" : "待签署"}`,
        },
      });
      return contract;
    });
    return ok(updated);
  } catch (error) {
    return apiError(error);
  }
}
