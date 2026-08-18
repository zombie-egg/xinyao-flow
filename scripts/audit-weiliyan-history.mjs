import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";

const db = new PrismaClient();
const applyChanges = process.env.APPLY_CHANGES === "true";
const stableId = (prefix, value) => `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 20)}`;
const targetNumbers = [
  "XYH25091511301016",
  "XYH26030911301",
  "XYH25122408201",
];

const users = await db.user.findMany({
  where: { name: { in: ["韦李燕", "曹琴"] } },
  select: { id: true, name: true, email: true, status: true },
});
const orders = await db.order.findMany({
  where: {
    OR: [
      { orderNumber: { in: targetNumbers } },
      { contract: { contractNumber: { in: targetNumbers } } },
    ],
  },
  select: {
    id: true,
    orderNumber: true,
    name: true,
    category: true,
    amount: true,
    createdAt: true,
    salesUser: { select: { id: true, name: true } },
    historicalSalesName: true,
    customer: {
      select: { id: true, name: true, owner: { select: { id: true, name: true } } },
    },
    contract: {
      select: {
        id: true,
        contractNumber: true,
        businessType: true,
        contractDate: true,
        signer: { select: { id: true, name: true } },
        responsibleUser: { select: { id: true, name: true } },
      },
    },
  },
});
const pacificCustomers = await db.customer.findMany({
  where: { nameNormalized: { contains: "太平洋电线电缆深圳有限公司" } },
  select: {
    id: true,
    name: true,
    owner: { select: { id: true, name: true } },
    pendingOwnerName: true,
    collaborators: { select: { user: { select: { id: true, name: true } } } },
    orders: {
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        salesUser: { select: { id: true, name: true } },
        historicalSalesName: true,
        contract: { select: { signer: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    },
  },
});

let repair = null;
if (applyChanges) {
  const wei = users.find((user) => user.name === "韦李燕");
  const cao = users.find((user) => user.name === "曹琴");
  const finance = await db.user.findFirst({ where: { name: "郭一铭", status: "ACTIVE" }, select: { id: true, name: true } });
  if (!wei || !cao) throw new Error("韦李燕或曹琴账号不存在");

  const [kobe, envMarchCustomer, occupationalAprilCustomer, pacific] = await Promise.all([
    db.customer.findFirst({ where: { name: "神户粘着制品（深圳）有限公司" }, select: { id: true, name: true } }),
    db.customer.findFirst({ where: { name: "东莞市炜豪兴包装制品有限公司" }, select: { id: true, name: true } }),
    db.customer.findFirst({ where: { name: "深圳市北鼎晶辉科技有限公司", category: "OCCUPATIONAL_HEALTH" }, select: { id: true, name: true } }),
    db.customer.findFirst({ where: { nameNormalized: { contains: "太平洋电线电缆深圳有限公司" } }, select: { id: true, name: true } }),
  ]);
  if (!kobe || !envMarchCustomer || !occupationalAprilCustomer || !pacific)
    throw new Error("目标客户匹配不完整，停止修复");

  const createHistoricalOrder = async (tx, data) => {
    const contractId = stableId("repair_contract", data.key);
    const orderId = stableId("repair_order", data.key);
    const existing = await tx.order.findUnique({ where: { id: orderId }, select: { id: true } });
    if (existing) return { orderId, created: false };
    await tx.contract.create({
      data: {
        id: contractId,
        contractNumber: data.number,
        name: `${data.project}合同`,
        businessType: data.businessType,
        signingStatus: "SIGNED",
        customerId: data.customerId,
        salesUserId: wei.id,
        signerId: wei.id,
        responsibleUserId: wei.id,
        collaboratorId: finance?.id,
        productTotal: data.amount,
        amount: data.amount,
        dealPrice: data.amount,
        technicalSupportFee: 0,
        outsourcingFee: 0,
        reviewFee: 0,
        otherExpense: 0,
        netOrderAmount: data.amount,
        expenseDetails: finance ? `历史财务协同人：${finance.name}` : null,
        contractDate: data.createdAt,
        status: "ORDER_CREATED",
        remark: "依据2026-08-18源文件复核补录",
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    });
    await tx.order.create({
      data: {
        id: orderId,
        orderNumber: data.number,
        contractId,
        customerId: data.customerId,
        category: data.category,
        salesUserId: wei.id,
        name: data.project,
        projectRequirements: data.project,
        remark: "依据2026-08-18源文件复核补录",
        amount: data.amount,
        approvalStatus: "APPROVED",
        technicalStatus: "PENDING",
        invoiceApplicationStatus: "COMPLETED",
        invoiceStatus: "PENDING",
        paymentStatus: "PENDING",
        paidAmount: 0,
        status: "IN_PROGRESS",
        approvedAt: data.createdAt,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    });
    await tx.receivable.create({
      data: {
        id: stableId("repair_receivable", data.key),
        orderId,
        number: data.receivableNumber,
        amount: data.amount,
        expectedDate: data.createdAt,
        remark: "历史数据复核补录",
        responsibleUserId: wei.id,
        collaboratorUserId: finance?.id,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    });
    await tx.operationLog.create({
      data: {
        userId: wei.id,
        action: "REPAIR_HISTORICAL_ORDER",
        module: "ORDER",
        targetId: orderId,
        description: `依据源文件补录历史订单：${data.number} · ${data.project}`,
      },
    });
    return { orderId, created: true };
  };

  repair = await db.$transaction(async (tx) => {
    const mixed = await tx.order.findFirst({
      where: { orderNumber: "XYH26030911301", amount: 1500 },
      select: { id: true, contractId: true },
    });
    if (!mixed) throw new Error("未找到被错误混合的XYH26030911301环境订单");
    await tx.contract.update({
      where: { id: mixed.contractId },
      data: {
        customerId: envMarchCustomer.id,
        businessType: "ENVIRONMENTAL_MONITORING",
        salesUserId: wei.id,
        signerId: wei.id,
        responsibleUserId: wei.id,
      },
    });
    await tx.order.update({
      where: { id: mixed.id },
      data: { customerId: envMarchCustomer.id, category: "XINYAO_ENVIRONMENT", salesUserId: wei.id },
    });

    const kobeOrder = await createHistoricalOrder(tx, {
      key: "XYH25091511301016-environment",
      number: "XYH25091511301016",
      receivableNumber: "PMO.XYH25091511301016",
      customerId: kobe.id,
      category: "XINYAO_ENVIRONMENT",
      businessType: "ENVIRONMENTAL_MONITORING",
      project: "日常环境检测",
      amount: 2800,
      createdAt: new Date("2026-04-29T01:35:00.000Z"),
      updatedAt: new Date("2026-05-06T00:51:00.000Z"),
    });
    const occupationalOrder = await createHistoricalOrder(tx, {
      key: "XYH26030911301-occupational",
      number: "XYH26030911301",
      receivableNumber: "PMO.XYH26030911301.OH",
      customerId: occupationalAprilCustomer.id,
      category: "OCCUPATIONAL_HEALTH",
      businessType: "OCCUPATIONAL_HEALTH",
      project: "职业卫生检测与评价",
      amount: 6000,
      createdAt: new Date("2026-04-29T01:29:00.000Z"),
      updatedAt: new Date("2026-05-06T00:52:00.000Z"),
    });

    const extra = await tx.order.findFirst({ where: { orderNumber: "XYH25122408201" }, select: { id: true, contractId: true } });
    if (!extra) throw new Error("未找到需要移交的XYH25122408201");
    await tx.order.update({ where: { id: extra.id }, data: { salesUserId: cao.id } });
    await tx.contract.update({ where: { id: extra.contractId }, data: { salesUserId: cao.id, signerId: cao.id, responsibleUserId: cao.id } });
    await tx.receivable.updateMany({ where: { orderId: extra.id }, data: { responsibleUserId: cao.id } });
    await tx.customer.update({ where: { id: pacific.id }, data: { ownerId: cao.id, pendingOwnerName: null, isPublicPool: false } });
    await tx.customerCollaborator.deleteMany({ where: { customerId: pacific.id, userId: wei.id } });
    await tx.operationLog.create({
      data: {
        userId: cao.id,
        action: "REPAIR_HISTORICAL_OWNERSHIP",
        module: "ORDER",
        targetId: extra.id,
        description: "依据源文件将XYH25122408201及太平洋电线电缆客户归属从韦李燕修正为曹琴",
      },
    });
    return { mixedOrderRestored: mixed.id, kobeOrder, occupationalOrder, reassignedOrder: extra.id, pacificCustomer: pacific.id };
  });
}

console.log(JSON.stringify({ applyChanges, repair, users, orders, pacificCustomers }, null, 2));
await db.$disconnect();
