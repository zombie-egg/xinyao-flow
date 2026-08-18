import fs from "node:fs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const source = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[\s（）()·，,。\.]/g, "");
const phoneNorm = (value) => text(value).replace(/[^0-9]/g, "");
const split = (value) => text(value).split(/[,，、;；/]/).map((item) => item.trim()).filter(Boolean);
const number = (value) => Number(text(value).replace(/,/g, "")) || 0;
const id = (prefix, value) => `${prefix}_${crypto.createHash("sha1").update(value).digest("hex").slice(0, 20)}`;
const date = (value) => {
  const parsed = new Date(text(value));
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
};
const businessType = (value) => text(value).includes("公共卫生") ? "PUBLIC_HEALTH" : text(value).includes("职业卫生") ? "OCCUPATIONAL_HEALTH" : "ENVIRONMENTAL_MONITORING";
const status = (value) => text(value).includes("忠诚") ? "LOYAL" : text(value).includes("成交") ? "WON" : text(value).includes("持续") || text(value).includes("跟进") ? "FOLLOWING" : text(value).includes("初步") ? "INITIAL_CONTACT" : "POTENTIAL";
const address = (row) => text(row["客户地址/详细地址"] || [row["客户地址/省"], row["客户地址/市"], row["客户地址/区"]].map(text).filter(Boolean).join(""));

const users = await db.user.findMany({ where: { status: "ACTIVE" }, include: { role: true, department: true } });
const userByName = new Map(users.map((user) => [user.name, user]));
const admin = users.find((user) => user.role.code === "ADMIN");
if (!admin) throw new Error("No active administrator found");

const customerRows = new Map(source.customers.map((row) => [norm(row["客户名称"]), row]));
const consolidated = [];
for (const row of source.orders) {
  const contractNumber = text(row["合同编号"]);
  const previous = consolidated.at(-1);
  if (previous && previous.contractNumber === contractNumber && !text(row["客户名称/名称"])) {
    previous.projects.push(text(row["检测项目"]));
    continue;
  }
  consolidated.push({ contractNumber, row, projects: [text(row["检测项目"])] });
}

const result = { sourceCustomers: source.customers.length, sourceOrderRows: source.orders.length, consolidatedOrders: consolidated.length, customersCreated: 0, customersUpdated: 0, customersCloned: 0, customersHeld: [], ordersReclassified: 0, ordersCreated: 0, ordersHeld: [] };
const occupationalByName = new Map();

async function ensureCustomer(name, fallbackOwnerName = "") {
  const key = norm(name);
  if (!key) return null;
  if (occupationalByName.has(key)) return occupationalByName.get(key);
  const sourceRow = customerRows.get(key);
  const existingOccupational = await db.customer.findFirst({ where: { category: "OCCUPATIONAL_HEALTH", nameNormalized: key }, orderBy: { updatedAt: "desc" } });
  if (existingOccupational) {
    occupationalByName.set(key, existingOccupational);
    return existingOccupational;
  }
  const originals = await db.customer.findMany({ where: { category: "XINYAO_ENVIRONMENT", nameNormalized: key }, orderBy: { updatedAt: "desc" }, take: 3 });
  const original = originals.length === 1 ? originals[0] : null;
  if (!sourceRow && originals.length > 1) {
    result.customersHeld.push({ name, reason: "心邀环境存在多个同名客户，无法唯一复制" });
    return null;
  }
  const ownerName = split(sourceRow?.["跟进人"] || fallbackOwnerName)[0] || "";
  const owner = userByName.get(ownerName);
  const departedOwner = ownerName && !owner ? ownerName : null;
  const sourcePhone = text(sourceRow?.["添加联系人/联系电话/电话"]);
  const phone = sourcePhone || original?.phone || "未填写";
  const contact = text(sourceRow?.["添加联系人/姓名"]) || original?.contact || "未填写";
  const created = await db.customer.create({
    data: {
      id: id("occ_customer", `${key}:${phoneNorm(phone)}`),
      category: "OCCUPATIONAL_HEALTH",
      name: text(sourceRow?.["客户名称"]) || original?.name || text(name),
      nameNormalized: key,
      contact,
      contactNormalized: norm(contact),
      phone,
      phoneNormalized: phoneNorm(phone),
      address: address(sourceRow || {}) || original?.address,
      contactInfo: [text(sourceRow?.["添加联系人/邮箱"]), text(sourceRow?.["添加联系人/部门"]), text(sourceRow?.["添加联系人/职务"])].filter(Boolean).join("；") || original?.contactInfo,
      remark: [text(sourceRow?.["添加联系人/备注"]), text(sourceRow?.["客户阶段"]) ? `客户阶段：${text(sourceRow["客户阶段"])}` : ""].filter(Boolean).join("；") || original?.remark || "源订单未提供客户联系方式，待补录",
      businessLine: sourceRow ? businessType(sourceRow["业务线"]) : original?.businessLine || "OCCUPATIONAL_HEALTH",
      monitoringType: text(sourceRow?.["职业卫生检测类型"] || sourceRow?.["环境检测类型"] || sourceRow?.["公共卫生检测类型"]) || original?.monitoringType,
      industry: text(sourceRow?.["客户行业"]) || original?.industry || "未填写",
      status: sourceRow ? status(sourceRow["客户状态"]) : original?.status || "POTENTIAL",
      nature: text(sourceRow?.["客户性质"]) || original?.nature,
      ownerId: owner?.id || original?.ownerId || null,
      pendingOwnerName: departedOwner,
      isPublicPool: false,
      createdById: owner?.id || original?.createdById || admin.id,
      createdAt: date(sourceRow?.["创建时间"]) || original?.createdAt || new Date(),
      updatedAt: date(sourceRow?.["更新时间"]) || original?.updatedAt || new Date(),
      contactMethods: { create: [{ label: "电话", value: phone, normalized: phoneNorm(phone) }] },
    },
  });
  result.customersCreated++;
  if (!sourceRow && original) result.customersCloned++;
  occupationalByName.set(key, created);
  return created;
}

for (const row of source.customers) await ensureCustomer(row["客户名称"], row["跟进人"]);

for (const item of consolidated) {
  const row = item.row;
  const customerName = text(row["客户名称/名称"]);
  const customer = await ensureCustomer(customerName, row["负责人"]);
  if (!customer) {
    result.ordersHeld.push({ contractNumber: item.contractNumber, customerName, reason: "职业卫生客户无法安全建立" });
    continue;
  }
  const existing = await db.order.findFirst({ where: { OR: [{ orderNumber: { equals: item.contractNumber, mode: "insensitive" } }, { contract: { contractNumber: { equals: item.contractNumber, mode: "insensitive" } } }] }, include: { contract: true, customer: true } });
  if (existing) {
    if (norm(existing.customer.name) !== norm(customerName)) {
      result.ordersHeld.push({ contractNumber: item.contractNumber, customerName, reason: `合同编号与其他客户冲突：${existing.customer.name}` });
      continue;
    }
    await db.$transaction([
      db.contract.update({ where: { id: existing.contractId }, data: { customerId: customer.id, businessType: "OCCUPATIONAL_HEALTH" } }),
      db.order.update({ where: { id: existing.id }, data: { category: "OCCUPATIONAL_HEALTH", customerId: customer.id } }),
    ]);
    result.ordersReclassified++;
    continue;
  }
  const ownerName = split(row["负责人"])[0] || split(row["签订人"])[0] || "";
  const owner = userByName.get(ownerName);
  const sales = owner || admin;
  const historicalSalesName = owner ? null : ownerName || null;
  const finance = split(row["协同人"]).map((name) => userByName.get(name)).find((user) => user && (user.department?.code === "FINANCE" || user.role.code.startsWith("FINANCE")));
  const amount = number(row["合同金额"]);
  const paidAmount = number(row["已收金额"]);
  const contractDate = date(row["签订日期"]) || date(row["创建时间"]);
  if (!item.contractNumber || !contractDate || amount <= 0) {
    result.ordersHeld.push({ contractNumber: item.contractNumber, customerName, reason: "合同编号、日期或金额无效" });
    continue;
  }
  const completed = text(row["合同状态"]).includes("完毕") || paidAmount >= amount;
  const contractId = id("occ_contract", item.contractNumber);
  const orderId = id("occ_order", item.contractNumber);
  await db.$transaction(async (tx) => {
    await tx.contract.create({ data: { id: contractId, contractNumber: item.contractNumber, name: `${item.projects.filter(Boolean).join("、") || "职业卫生"}合同`, businessType: "OCCUPATIONAL_HEALTH", signingStatus: "SIGNED", customerId: customer.id, salesUserId: sales.id, historicalSalesName, responsibleUserId: sales.id, collaboratorId: finance?.id, productTotal: number(row["产品合计"]), amount, dealPrice: amount, technicalSupportFee: number(row["技术支持费用"]), outsourcingFee: number(row["外包费用"]), reviewFee: number(row["评审费用"]), otherExpense: number(row["其他支出"]), netOrderAmount: number(row["净签单金额"]), expenseDetails: text(row["外包、评审、技术支持费明细备注"]) || null, originalExpenseNote: text(row["原技术支持/外包/评审费"]) || null, contractDate, status: completed ? "COMPLETED" : "ORDER_CREATED", createdAt: date(row["创建时间"]) || contractDate, updatedAt: date(row["更新时间"]) || contractDate } });
    await tx.order.create({ data: { id: orderId, orderNumber: item.contractNumber, contractId, customerId: customer.id, category: "OCCUPATIONAL_HEALTH", salesUserId: sales.id, historicalSalesName, name: "职业卫生定期检测", projectRequirements: item.projects.filter(Boolean).join("、"), remark: text(row["订单备注"]) || null, amount, approvalStatus: "APPROVED", technicalStatus: completed ? "COMPLETED" : "PENDING", invoiceApplicationStatus: "COMPLETED", invoiceStatus: number(row["开票金额"]) >= amount ? "COMPLETED" : number(row["开票金额"]) > 0 ? "PARTIAL" : "PENDING", paymentStatus: paidAmount >= amount ? "COMPLETED" : paidAmount > 0 ? "PARTIAL" : "PENDING", paidAmount, status: completed ? "COMPLETED" : "IN_PROGRESS", approvedAt: contractDate, createdAt: date(row["创建时间"]) || contractDate, updatedAt: date(row["更新时间"]) || contractDate } });
    await tx.receivable.create({ data: { id: id("occ_receivable", item.contractNumber), orderId, number: `PMO.${item.contractNumber}`, amount, expectedDate: contractDate, remark: "职业卫生历史数据导入", responsibleUserId: sales.id, collaboratorUserId: finance?.id } });
    if (paidAmount > 0) await tx.payment.create({ data: { id: id("occ_payment", item.contractNumber), orderId, amount: paidAmount, paidAt: date(row["更新时间"]) || contractDate, note: "职业卫生历史累计回款导入" } });
  });
  result.ordersCreated++;
}

fs.writeFileSync(process.argv[3] || "/tmp/occupational-import-result.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await db.$disconnect();
