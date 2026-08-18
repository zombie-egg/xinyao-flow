import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const source = process.argv[2] && fs.existsSync(process.argv[2]) ? JSON.parse(fs.readFileSync(process.argv[2], "utf8")) : null;
const norm = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s（）()·，,。\.]/g, "");
const cutoff = new Date(Date.now() - 30 * 86400000);

const [customerGroups, orderGroups, inconsistentPublic, ownerlessTracked, claimLogs, categoryMismatch, customerMismatch, salesMismatch, submitLogs] = await Promise.all([
  db.customer.groupBy({ by: ["category", "isPublicPool"], _count: { id: true } }),
  db.order.groupBy({ by: ["category"], _count: { id: true } }),
  db.customer.findMany({ where: { isPublicPool: true, ownerId: { not: null } }, select: { id: true, name: true, category: true, owner: { select: { name: true } }, updatedAt: true } }),
  db.customer.findMany({ where: { isPublicPool: false, ownerId: null }, select: { id: true, name: true, category: true, pendingOwnerName: true, updatedAt: true }, take: 200 }),
  db.operationLog.findMany({ where: { action: "CLAIM_PUBLIC_CUSTOMER", createdAt: { gte: cutoff } }, select: { targetId: true, createdAt: true, user: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
  db.order.findMany({ select: { id: true, orderNumber: true, category: true, customer: { select: { name: true, category: true } } } }),
  db.order.findMany({ select: { id: true, orderNumber: true, customerId: true, contract: { select: { customerId: true } }, customer: { select: { name: true } } } }),
  db.order.findMany({ select: { id: true, orderNumber: true, salesUserId: true, historicalSalesName: true, salesUser: { select: { name: true } }, contract: { select: { salesUserId: true } } } }),
  db.operationLog.findMany({ where: { action: "SUBMIT_ORDER", createdAt: { gte: cutoff }, targetId: { not: null } }, select: { targetId: true, createdAt: true, userId: true, user: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
]);

const customerById = new Map((await db.customer.findMany({ where: { id: { in: claimLogs.map((item) => item.targetId).filter(Boolean) } }, select: { id: true, name: true, nameNormalized: true, category: true, isPublicPool: true, owner: { select: { name: true } } } })).map((item) => [item.id, item]));
const claimsByName = new Map();
for (const log of claimLogs) {
  const customer = log.targetId ? customerById.get(log.targetId) : null;
  const key = `${customer?.category || "UNKNOWN"}:${customer?.nameNormalized || log.targetId}`;
  const rows = claimsByName.get(key) || [];
  rows.push({ customerId: log.targetId, customerName: customer?.name, claimant: log.user?.name, claimedAt: log.createdAt, currentPublic: customer?.isPublicPool, currentOwner: customer?.owner?.name });
  claimsByName.set(key, rows);
}
const repeatedClaims = [...claimsByName.values()].filter((rows) => rows.length > 1);
const submitOrderIds = submitLogs.map((item) => item.targetId).filter(Boolean);
const submittedOrders = new Map((await db.order.findMany({ where: { id: { in: submitOrderIds } }, select: { id: true, orderNumber: true, salesUserId: true, salesUser: { select: { name: true } }, customer: { select: { name: true, owner: { select: { name: true } } } } } })).map((item) => [item.id, item]));
const submitterMismatches = submitLogs.flatMap((log) => {
  const order = log.targetId ? submittedOrders.get(log.targetId) : null;
  return order && log.userId !== order.salesUserId ? [{ orderNumber: order.orderNumber, customer: order.customer.name, submitter: log.user?.name, recordedSales: order.salesUser.name, customerOwner: order.customer.owner?.name, submittedAt: log.createdAt }] : [];
});

let sourceAudit = null;
if (source) {
  const contractNumbers = [...new Set(source.orders.map((row) => String(row["合同编号"] ?? "").trim()).filter(Boolean))];
  const sourceCustomerNames = [...new Set(source.customers.map((row) => norm(row["客户名称"])).filter(Boolean))];
  const [orders, customers] = await Promise.all([
    db.order.findMany({ where: { orderNumber: { in: contractNumbers } }, select: { orderNumber: true, category: true, customer: { select: { name: true, category: true } } } }),
    db.customer.findMany({ where: { category: "OCCUPATIONAL_HEALTH", nameNormalized: { in: sourceCustomerNames } }, select: { nameNormalized: true } }),
  ]);
  const foundContracts = new Set(orders.map((item) => item.orderNumber));
  const foundCustomers = new Set(customers.map((item) => item.nameNormalized));
  sourceAudit = {
    expectedOrderRows: source.orders.length,
    expectedUniqueContracts: contractNumbers.length,
    foundContracts: foundContracts.size,
    missingContracts: contractNumbers.filter((item) => !foundContracts.has(item)),
    wrongCategoryOrders: orders.filter((item) => item.category !== "OCCUPATIONAL_HEALTH" || item.customer.category !== "OCCUPATIONAL_HEALTH"),
    expectedCustomers: sourceCustomerNames.length,
    foundCustomers: foundCustomers.size,
    missingCustomers: sourceCustomerNames.filter((item) => !foundCustomers.has(item)),
  };
}

const result = {
  generatedAt: new Date().toISOString(),
  counts: { customerGroups, orderGroups },
  customerAnomalies: { inconsistentPublic, ownerlessTracked, repeatedClaims },
  orderAnomalies: {
    categoryMismatch: categoryMismatch.filter((item) => item.category !== item.customer.category),
    customerMismatch: customerMismatch.filter((item) => item.customerId !== item.contract.customerId),
    salesMismatch: salesMismatch.filter((item) => !item.historicalSalesName && item.salesUserId !== item.contract.salesUserId),
    submitterMismatches,
  },
  sourceAudit,
};
console.log(JSON.stringify(result));
await db.$disconnect();
