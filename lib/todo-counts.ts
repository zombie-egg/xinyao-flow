import type { RoleCode } from "@prisma/client";
import { db } from "./db";

export async function todoCounts(user: {
  id: string;
  departmentId: string | null;
  role: { code: RoleCode };
}) {
  const jobs: Array<Promise<[string, number]>> = [];
  const add = (path: string, query: Promise<number>) => {
    jobs.push(query.then((count) => [path, count]));
  };
  const role = user.role.code;
  if (role === "SALES_MANAGER")
    add("/reviews", db.order.count({
      where: {
        historicalSalesName: null,
        approvalStatus: "PENDING_SALES_MANAGER",
        salesUser: { departmentId: user.departmentId },
      },
    }));
  else if (role.startsWith("FINANCE"))
    add("/reviews", db.order.count({
      where: { historicalSalesName: null, approvalStatus: "PENDING_FINANCE" },
    }));
  else if (role === "ADMIN")
    add("/reviews", db.order.count({
      where: { historicalSalesName: null, approvalStatus: "PENDING_ADMIN" },
    }));
  if (role === "ADMIN") {
    add("/approvals", db.leaveRequest.count({
      where: { status: "PENDING_ADMIN" },
    }));
    add("/attendance-processing", db.attendanceException.count({
      where: { status: "PENDING_ADMIN", disposition: "PENDING" },
    }));
  } else if (role === "SALES_MANAGER" || role === "TECH_MANAGER") {
    add("/approvals", db.leaveRequest.count({
      where: {
        status: "PENDING_MANAGER",
        user: { departmentId: user.departmentId },
      },
    }));
    add("/attendance-processing", db.attendanceException.count({
      where: {
        status: "PENDING_MANAGER",
        disposition: "PENDING",
        attendance: { user: { departmentId: user.departmentId } },
      },
    }));
  }
  if (role.startsWith("FINANCE")) {
    add("/finance/invoices", db.order.count({
      where: {
        historicalSalesName: null,
        approvalStatus: "APPROVED",
        invoiceApplicationStatus: "COMPLETED",
        invoiceStatus: "PENDING",
      },
    }));
    add("/finance/payments", db.order.count({
      where: {
        historicalSalesName: null,
        approvalStatus: "APPROVED",
        paymentStatus: { not: "COMPLETED" },
        OR: [
          { receivable: { isNot: null } },
          {
            invoiceStatus: "COMPLETED",
            paymentStatus: { in: ["PENDING", "PARTIAL"] },
          },
        ],
      },
    }));
  }
  if (role === "TECH_MANAGER")
    add("/tasks", db.order.count({
      where: { historicalSalesName: null, approvalStatus: "APPROVED", technicalUserId: null },
    }));
  else if (role === "TECH_EMPLOYEE")
    add("/tasks", db.order.count({
      where: {
        historicalSalesName: null,
        approvalStatus: "APPROVED",
        technicalUserId: user.id,
        technicalStatus: { in: ["PENDING", "PROCESSING"] },
      },
    }));
  if (role.startsWith("SALES") || role === "ADMIN")
    add("/invoice-applications", db.order.count({
      where: {
        historicalSalesName: null,
        OR: [
          { salesUserId: user.id },
          { customer: { collaborators: { some: { userId: user.id } } } },
        ],
        approvalStatus: "APPROVED",
        invoiceApplicationStatus: "PENDING",
      },
    }));
  return Object.fromEntries(await Promise.all(jobs));
}
