import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
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

console.log(JSON.stringify({ users, orders, pacificCustomers }, null, 2));
await db.$disconnect();
