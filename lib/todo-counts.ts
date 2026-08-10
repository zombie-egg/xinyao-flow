import type { RoleCode } from "@prisma/client";
import { db } from "./db";

export async function todoCounts(user: {
  id: string;
  departmentId: string | null;
  role: { code: RoleCode };
}) {
  const counts: Record<string, number> = {};
  const role = user.role.code;
  if (role === "SALES_MANAGER")
    counts["/reviews"] = await db.order.count({
      where: {
        approvalStatus: "PENDING_SALES_MANAGER",
        salesUser: { departmentId: user.departmentId },
      },
    });
  else if (role.startsWith("FINANCE"))
    counts["/reviews"] = await db.order.count({
      where: { approvalStatus: "PENDING_FINANCE" },
    });
  else if (role === "ADMIN")
    counts["/reviews"] = await db.order.count({
      where: { approvalStatus: "PENDING_ADMIN" },
    });
  if (role === "ADMIN") {
    counts["/approvals"] = await db.leaveRequest.count({
      where: { status: "PENDING_ADMIN" },
    });
    counts["/attendance-processing"] = await db.attendanceException.count({
      where: { status: "PENDING_ADMIN", disposition: "PENDING" },
    });
  } else if (role === "SALES_MANAGER" || role === "TECH_MANAGER") {
    counts["/approvals"] = await db.leaveRequest.count({
      where: {
        status: "PENDING_MANAGER",
        user: { departmentId: user.departmentId },
      },
    });
    counts["/attendance-processing"] = await db.attendanceException.count({
      where: {
        status: "PENDING_MANAGER",
        disposition: "PENDING",
        attendance: { user: { departmentId: user.departmentId } },
      },
    });
  }
  if (role.startsWith("FINANCE")) {
    counts["/finance/invoices"] = await db.order.count({
      where: {
        approvalStatus: "APPROVED",
        invoiceApplicationStatus: "COMPLETED",
        invoiceStatus: "PENDING",
      },
    });
    counts["/finance/payments"] = await db.order.count({
      where: {
        approvalStatus: "APPROVED",
        invoiceStatus: "COMPLETED",
        paymentStatus: { in: ["PENDING", "PARTIAL"] },
      },
    });
  }
  if (role === "TECH_MANAGER")
    counts["/tasks"] = await db.order.count({
      where: { approvalStatus: "APPROVED", technicalUserId: null },
    });
  else if (role === "TECH_EMPLOYEE")
    counts["/tasks"] = await db.order.count({
      where: {
        approvalStatus: "APPROVED",
        technicalUserId: user.id,
        technicalStatus: { in: ["PENDING", "PROCESSING"] },
      },
    });
  if (role.startsWith("SALES"))
    counts["/invoice-applications"] = await db.order.count({
      where: {
        salesUserId: user.id,
        approvalStatus: "APPROVED",
        invoiceApplicationStatus: "PENDING",
      },
    });
  return counts;
}
