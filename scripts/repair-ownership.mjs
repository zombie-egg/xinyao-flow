import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const cutoff = new Date(Date.now() - 30 * 86400000);
const claimLogs = await db.operationLog.findMany({ where: { action: "CLAIM_PUBLIC_CUSTOMER", createdAt: { gte: cutoff }, targetId: { not: null }, userId: { not: null } }, select: { targetId: true, userId: true, createdAt: true }, orderBy: { createdAt: "asc" } });
const claimsByCustomer = new Map();
for (const log of claimLogs) {
  const rows = claimsByCustomer.get(log.targetId) || [];
  rows.push(log);
  claimsByCustomer.set(log.targetId, rows);
}
let customersRepaired = 0;
for (const [customerId, logs] of claimsByCustomer) {
  if (logs.length < 2) continue;
  const latest = logs.at(-1);
  const [customer, owner] = await Promise.all([
    db.customer.findUnique({ where: { id: customerId }, select: { isPublicPool: true, ownerId: true, name: true } }),
    db.user.findFirst({ where: { id: latest.userId, status: "ACTIVE", role: { code: { in: ["ADMIN", "SALES_MANAGER", "SALES_EMPLOYEE"] } } }, select: { id: true } }),
  ]);
  if (!customer?.isPublicPool || customer.ownerId || !owner) continue;
  await db.$transaction([
    db.customer.update({ where: { id: customerId }, data: { isPublicPool: false, ownerId: owner.id, pendingOwnerName: null } }),
    db.operationLog.create({ data: { userId: owner.id, action: "REPAIR_CLAIMED_CUSTOMER", module: "CUSTOMER", targetId: customerId, description: `根据最后一次认领日志恢复客户归属：${customer.name}` } }),
  ]);
  customersRepaired++;
}

const submitLogs = await db.operationLog.findMany({ where: { action: "SUBMIT_ORDER", createdAt: { gte: cutoff }, targetId: { not: null }, userId: { not: null } }, select: { targetId: true, userId: true }, orderBy: { createdAt: "desc" } });
let ordersRepaired = 0;
const handled = new Set();
for (const log of submitLogs) {
  if (handled.has(log.targetId)) continue;
  handled.add(log.targetId);
  const order = await db.order.findUnique({ where: { id: log.targetId }, select: { id: true, orderNumber: true, salesUserId: true, historicalSalesName: true, contractId: true } });
  if (!order || order.historicalSalesName || order.salesUserId === log.userId) continue;
  const submitter = await db.user.findFirst({ where: { id: log.userId, status: "ACTIVE", role: { code: { in: ["ADMIN", "SALES_MANAGER", "SALES_EMPLOYEE"] } } }, select: { id: true } });
  if (!submitter) continue;
  await db.$transaction([
    db.order.update({ where: { id: order.id }, data: { salesUserId: submitter.id } }),
    db.contract.update({ where: { id: order.contractId }, data: { salesUserId: submitter.id } }),
    db.operationLog.create({ data: { userId: submitter.id, action: "REPAIR_ORDER_SALES_OWNER", module: "ORDER", targetId: order.id, description: `根据提交日志恢复订单销售归属：${order.orderNumber || order.id}` } }),
  ]);
  ordersRepaired++;
}

console.log(JSON.stringify({ customersRepaired, ordersRepaired }));
await db.$disconnect();
