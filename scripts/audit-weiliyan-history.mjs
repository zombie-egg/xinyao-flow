import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";

const db = new PrismaClient();
const applyChanges = process.env.APPLY_CHANGES === "true";
const stableId = (prefix, value) => `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 20)}`;
const targetNumbers = [
  "XYH25091511301016",
  "XYH26030911301",
  "XYH25122408201",
  "XYH24041011401",
  "XYH24041011401A1",
  "XYH26041013702、XYH26032713701",
  "XYH26041013702",
  "XYH26032713701",
  "XYH26020611901",
  "XYH26020311901",
  "XYH26020213601",
  "XYH26012113601",
  "XYG25061614302",
  "XYH26031008201",
  "XYH26031008201001",
  "XYH26051214402",
  "XYH26072214401",
  "XYH26072314301",
  "XYG26060514301",
  "XYH26042414307",
  "XYG26032314303",
  "XYG26042714301",
  "XYH26032614302",
  "XYG26022714306",
  "XYG26012114302",
];

const users = await db.user.findMany({
  where: { name: { in: ["韦李燕", "曹琴", "刘丽花", "刘丽文", "李华锋", "颜锦杏", "王静", "刘秀兰"] } },
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
const requestedCustomers = await db.customer.findMany({
  where: {
    name: {
      in: [
        "深圳市联瑞汽车销售服务有限公司",
        "深圳宝兴医院排榜社区健康服务中心",
        "深圳宝兴医院排榜社区健康服务站",
        "深圳万基隆电子科技有限公司",
        "时代天源（深圳）科技有限公司",
        "中铁十一局集团有限公司",
        "昊极科技（广东）有限公司",
        "深圳市深长城商企服务集团有限公司",
        "深圳市宝安区新安街道文汇幼儿园",
        "深圳龙岗芽咪龙园大观托育服务有限公司",
      ],
    },
  },
  select: { id: true, name: true, category: true, businessLine: true, owner: { select: { name: true } } },
});

let repair = null;
if (applyChanges) {
  const wei = users.find((user) => user.name === "韦李燕");
  const cao = users.find((user) => user.name === "曹琴");
  const liulihua = users.find((user) => user.name === "刘丽花");
  const liuwen = users.find((user) => user.name === "刘丽文");
  const lihuafeng = users.find((user) => user.name === "李华锋");
  const yanjinxing = users.find((user) => user.name === "颜锦杏");
  const wangjing = users.find((user) => user.name === "王静");
  const finance = await db.user.findFirst({ where: { name: "郭一铭", status: "ACTIVE" }, select: { id: true, name: true } });
  if (!wei || !cao || !liulihua || !liuwen || !lihuafeng || !yanjinxing || !wangjing) throw new Error("目标销售账号匹配不完整");

  const [kobe, envMarchCustomer, occupationalAprilCustomer, pacific, fulai, xinlishengyuan, lianrui, baoxing, wanjilong] = await Promise.all([
    db.customer.findFirst({ where: { name: "神户粘着制品（深圳）有限公司" }, select: { id: true, name: true } }),
    db.customer.findFirst({ where: { name: "东莞市炜豪兴包装制品有限公司" }, select: { id: true, name: true } }),
    db.customer.findFirst({ where: { name: "深圳市北鼎晶辉科技有限公司", category: "OCCUPATIONAL_HEALTH" }, select: { id: true, name: true } }),
    db.customer.findFirst({ where: { nameNormalized: { contains: "太平洋电线电缆深圳有限公司" } }, select: { id: true, name: true } }),
    db.customer.findFirst({ where: { name: "富来世寿塑料（深圳）有限公司" }, select: { id: true, name: true } }),
    db.customer.findFirst({ where: { name: "深圳市新力盛源环保科技有限公司" }, select: { id: true, name: true } }),
    db.customer.findFirst({ where: { name: "深圳市联瑞汽车销售服务有限公司" }, select: { id: true, name: true } }),
    db.customer.findFirst({ where: { name: "深圳宝兴医院排榜社区健康服务站" }, select: { id: true, name: true } }),
    db.customer.findFirst({ where: { name: "深圳万基隆电子科技有限公司" }, select: { id: true, name: true } }),
  ]);
  if (!kobe || !envMarchCustomer || !occupationalAprilCustomer || !pacific || !fulai || !xinlishengyuan || !lianrui || !baoxing || !wanjilong)
    throw new Error("目标客户匹配不完整，停止修复");

  const createHistoricalOrder = async (tx, data) => {
    const contractId = stableId("repair_contract", data.key);
    const orderId = stableId("repair_order", data.key);
    const existing = await tx.order.findUnique({ where: { id: orderId }, select: { id: true } });
    if (existing) return { orderId, created: false };
    const dayStart = new Date(data.createdAt);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const matching = await tx.order.findFirst({ where: { orderNumber: data.number, customerId: data.customerId, amount: data.amount, createdAt: { gte: dayStart, lt: dayEnd } }, select: { id: true } });
    if (matching) return { orderId: matching.id, created: false };
    await tx.contract.create({
      data: {
        id: contractId,
        contractNumber: data.number,
        name: `${data.project}合同`,
        businessType: data.businessType,
        signingStatus: "SIGNED",
        customerId: data.customerId,
        salesUserId: data.salesUserId,
        signerId: data.salesUserId,
        responsibleUserId: data.salesUserId,
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
        salesUserId: data.salesUserId,
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
        responsibleUserId: data.salesUserId,
        collaboratorUserId: finance?.id,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    });
    await tx.operationLog.create({
      data: {
        userId: data.salesUserId,
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
      salesUserId: wei.id,
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
      salesUserId: wei.id,
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
    const duplicateA1 = await createHistoricalOrder(tx, {
      key: "XYH24041011401A1-environment",
      number: "XYH24041011401A1",
      receivableNumber: "PMO.XYH24041011401A1",
      customerId: fulai.id,
      category: "XINYAO_ENVIRONMENT",
      businessType: "ENVIRONMENTAL_MONITORING",
      project: "日常环境检测",
      amount: 6700,
      salesUserId: liulihua.id,
      createdAt: new Date("2024-04-23T01:31:00.000Z"),
      updatedAt: new Date("2024-04-23T03:14:00.000Z"),
    });
    const combinedLihuafeng = await createHistoricalOrder(tx, {
      key: "XYH26041013702-XYH26032713701-environment",
      number: "XYH26041013702、XYH26032713701",
      receivableNumber: "PMO.XYH26041013702、XYH26032713701",
      customerId: xinlishengyuan.id,
      category: "XINYAO_ENVIRONMENT",
      businessType: "ENVIRONMENTAL_MONITORING",
      project: "日常环境检测",
      amount: 1200,
      salesUserId: lihuafeng.id,
      createdAt: new Date("2026-04-16T07:22:00.000Z"),
      updatedAt: new Date("2026-04-29T02:03:00.000Z"),
    });
    const ownerRepairs = [];
    for (const item of [
      { number: "XYH26020611901", user: yanjinxing },
      { number: "XYH26020311901", user: yanjinxing },
      { number: "XYH26020213601", user: wangjing },
      { number: "XYH26012113601", user: wangjing },
      { number: "XYH26031008201", user: cao },
      { number: "XYH26031008201001", user: cao },
      { number: "XYH26072214401", user: liuwen },
    ]) {
      const matches = await tx.order.findMany({
        where: { orderNumber: item.number },
        select: { id: true, contractId: true },
      });
      if (matches.length !== 1)
        throw new Error(`订单${item.number}匹配到${matches.length}条，停止负责人修复`);
      const order = matches[0];
      await tx.order.update({ where: { id: order.id }, data: { salesUserId: item.user.id } });
      await tx.contract.update({ where: { id: order.contractId }, data: { salesUserId: item.user.id, signerId: item.user.id, responsibleUserId: item.user.id } });
      await tx.receivable.updateMany({ where: { orderId: order.id }, data: { responsibleUserId: item.user.id } });
      await tx.operationLog.create({
        data: {
          userId: item.user.id,
          action: "REPAIR_HISTORICAL_ORDER_OWNER",
          module: "ORDER",
          targetId: order.id,
          description: `依据源文件修正历史订单负责人：${item.number} → ${item.user.name}`,
        },
      });
      ownerRepairs.push({ orderNumber: item.number, orderId: order.id, owner: item.user.name });
    }
    await tx.customer.update({ where: { id: lianrui.id }, data: { category: "XINYAO_ENVIRONMENT", businessLine: "ENVIRONMENTAL_MONITORING" } });
    const lianrui2025 = await createHistoricalOrder(tx, {
      key: "XYG25061614302-2025",
      number: "XYG25061614302",
      receivableNumber: "PMO.XYG25061614302-2025",
      customerId: lianrui.id,
      category: "XINYAO_ENVIRONMENT",
      businessType: "ENVIRONMENTAL_MONITORING",
      project: "日常环境检测",
      amount: 4500,
      salesUserId: liulihua.id,
      createdAt: new Date("2025-06-24T08:26:00.000Z"),
      updatedAt: new Date("2025-06-26T10:34:00.000Z"),
    });
    const lianrui2026 = await createHistoricalOrder(tx, {
      key: "XYG25061614302-2026",
      number: "XYG25061614302",
      receivableNumber: "PMO.XYG25061614302-2026",
      customerId: lianrui.id,
      category: "XINYAO_ENVIRONMENT",
      businessType: "ENVIRONMENTAL_MONITORING",
      project: "日常环境检测",
      amount: 4500,
      salesUserId: liulihua.id,
      createdAt: new Date("2026-07-28T02:02:00.000Z"),
      updatedAt: new Date("2026-08-10T06:41:00.000Z"),
    });
    const baoxingOrder = await createHistoricalOrder(tx, {
      key: "XYH26051214402-environment",
      number: "XYH26051214402",
      receivableNumber: "PMO.XYH26051214402",
      customerId: baoxing.id,
      category: "XINYAO_ENVIRONMENT",
      businessType: "ENVIRONMENTAL_MONITORING",
      project: "日常环境检测",
      amount: 2000,
      salesUserId: liuwen.id,
      createdAt: new Date("2026-06-02T07:22:00.000Z"),
      updatedAt: new Date("2026-07-10T02:09:00.000Z"),
    });
    return { mixedOrderRestored: mixed.id, kobeOrder, occupationalOrder, reassignedOrder: extra.id, pacificCustomer: pacific.id, duplicateA1, combinedLihuafeng, ownerRepairs, lianrui2025, lianrui2026, baoxingOrder };
  });
}

console.log(JSON.stringify({ applyChanges, repair, users, orders, pacificCustomers, requestedCustomers }, null, 2));
await db.$disconnect();
