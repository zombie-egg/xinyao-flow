import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { z } from "zod";
import { chinaDateNumber, documentNumber } from "@/lib/document-number";
const schema = z
  .object({
    result: z.enum(["APPROVE", "REJECT"]),
    comment: z.string().trim().max(1000).optional(),
  })
  .superRefine((v, c) => {
    if (v.result === "REJECT" && !v.comment)
      c.addIssue({ code: "custom", message: "拒绝时必须填写原因" });
  });
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const u = await requireUser(),
      { id } = await params,
      p = schema.safeParse(await req.json());
    if (!p.success) return fail(p.error.issues[0].message, "VALIDATION_ERROR");
    const order = await db.order.findUnique({
      where: { id },
      include: { salesUser: true,contract:true },
    });
    if (!order) return fail("订单不存在", "NOT_FOUND", 404);
    const managerStage = order.approvalStatus === "PENDING_SALES_MANAGER",
      financeStage = order.approvalStatus === "PENDING_FINANCE",
      adminStage = order.approvalStatus === "PENDING_ADMIN";
    if (
      managerStage &&
      (u.role.code !== "SALES_MANAGER" ||
        u.departmentId !== order.salesUser.departmentId)
    )
      throw new Error("FORBIDDEN");
    if (financeStage && !u.role.code.startsWith("FINANCE"))
      throw new Error("FORBIDDEN");
    if (adminStage && u.role.code !== "ADMIN") throw new Error("FORBIDDEN");
    if (!managerStage && !financeStage && !adminStage)
      return fail("当前状态不能审核", "INVALID_STATE", 409);
    const stage = managerStage
      ? "销售经理审核"
      : financeStage
        ? "财务审核"
        : "管理员审核";
    const updated = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`order-review-${id}`}))`;
      const fresh = await tx.order.findUniqueOrThrow({ where: { id } });
      if (fresh.approvalStatus !== order.approvalStatus)
        throw new Error("ALREADY_PROCESSED");
      let data, contractNumber: string | undefined;
      if (p.data.result === "REJECT") {
        data = {
          approvalStatus: managerStage
            ? ("MANAGER_REJECTED" as const)
            : financeStage
              ? ("FINANCE_REJECTED" as const)
              : ("ADMIN_REJECTED" as const),
          status: "REJECTED" as const,
        };
      } else if (managerStage)
        data = {
          approvalStatus: "PENDING_FINANCE" as const,
          status: "PENDING_FINANCE" as const,
        };
      else if (financeStage)
        data = {
          approvalStatus: "PENDING_ADMIN" as const,
          status: "PENDING_ADMIN" as const,
        };
      else {
        if (!order.salesUser.employeeNumber)
          throw new Error("EMPLOYEE_NUMBER_REQUIRED");
        contractNumber=order.contract.contractNumber||undefined;
        if(!contractNumber){const date=chinaDateNumber();await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`contract-number-${order.salesUser.employeeNumber}-${date}`}))`;const count=await tx.contract.count({where:{contractNumber:{startsWith:date,endsWith:order.salesUser.employeeNumber}}});contractNumber=documentNumber(order.salesUser.employeeNumber,date,count+1)}
        data = {
          approvalStatus: "APPROVED" as const,
          status: "APPROVED" as const,
          orderNumber: contractNumber,
          approvedAt: new Date(),
          technicalStatus: "PENDING" as const,
          technicalUserId: null,
          invoiceApplicationStatus: "PENDING" as const,
          invoiceStatus: "NOT_REQUIRED" as const,
        };
      }
      const item = await tx.order.update({ where: { id }, data });
      await tx.contractApproval.create({
        data: {
          orderId: id,
          approverId: u.id,
          stage,
          result: p.data.result === "APPROVE" ? "通过" : "拒绝",
          comment: p.data.comment,
        },
      });
      await tx.operationLog.create({
        data: {
          userId: u.id,
          action:
            p.data.result === "APPROVE" ? "APPROVE_ORDER" : "REJECT_ORDER",
          module: "ORDER",
          targetId: id,
          description: `${stage}${p.data.result === "APPROVE" ? "通过" : "拒绝"}${p.data.comment ? `：${p.data.comment}` : ""}`,
        },
      });
      if (p.data.result === "APPROVE" && managerStage) {
        const finance = await tx.user.findMany({
          where: { department: { code: "FINANCE" }, status: "ACTIVE" },
        });
        if (finance.length)
          await tx.notification.createMany({
            data: finance.map((a) => ({
              userId: a.id,
              type: "APPROVAL" as const,
              title: "订单等待财务审核",
              content: item.name,
              targetId: id,
            })),
          });
      }
      if (p.data.result === "APPROVE" && financeStage) {
        const admins = await tx.user.findMany({
          where: { role: { code: "ADMIN" }, status: "ACTIVE" },
        });
        if (admins.length)
          await tx.notification.createMany({
            data: admins.map((a) => ({
              userId: a.id,
              type: "APPROVAL" as const,
              title: "订单等待管理员审核",
              content: item.name,
              targetId: id,
            })),
          });
      }
      if (p.data.result === "APPROVE" && adminStage) {
        await tx.notification.create({data:{userId:item.salesUserId,type:'ORDER',title:'订单已审核，请申请开票',content:`${item.orderNumber} · 合同编号 ${contractNumber}`,targetId:id}});
        const recipients = await tx.user.findMany({where:{role:{code:"TECH_MANAGER"},status:"ACTIVE"}});
        if (recipients.length)
          await tx.notification.createMany({
            data: recipients.map((r) => ({
              userId: r.id,
              type: "ORDER" as const,
              title: "订单已审核，等待技术分配",
              content: `订单号 ${item.orderNumber}`,
              targetId: id,
            })),
          });
        await tx.contract.update({
          where: { id: item.contractId },
          data: { status: "ORDER_CREATED", contractNumber },
        });
      }
      if (p.data.result === "REJECT")
        await tx.notification.create({
          data: {
            userId: item.salesUserId,
            type: "APPROVAL",
            title: "订单审核未通过",
            content: `${stage}拒绝：${p.data.comment}`,
            targetId: id,
          },
        });
      return item;
    });
    return ok(updated);
  } catch (e) {
    if (e instanceof Error && e.message === "EMPLOYEE_NUMBER_REQUIRED")
      return fail(
        "负责销售尚未设置工号，请先由管理员设置员工工号",
        "EMPLOYEE_NUMBER_REQUIRED",
        409,
      );
    if (e instanceof Error && e.message === "ALREADY_PROCESSED")
      return fail("该订单已被其他人处理", "ALREADY_PROCESSED", 409);
    return apiError(e);
  }
}
