import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ok, apiError } from "@/lib/api";
import { statisticsDateRange, statisticsOrderWhere } from "@/lib/statistics";

export async function GET(req: Request) {
  try {
    await requirePermission("statistics:view");
    const query = new URL(req.url).searchParams;
    const range = statisticsDateRange(query.get("start") || undefined, query.get("end") || undefined);
    const where = statisticsOrderWhere(range);
    const [rows, payments] = await Promise.all([
      db.order.groupBy({
        by: ["salesUserId"],
        where,
        _count: { id: true },
        _sum: { amount: true, paidAmount: true },
        orderBy: { _sum: { amount: "desc" } },
      }),
      db.payment.aggregate({ where: { order: where }, _sum: { amount: true } }),
    ]);
    const users = await db.user.findMany({
      where: { id: { in: rows.map((row) => row.salesUserId) } },
      select: { id: true, name: true },
    });
    return ok({
      rows: rows.map((row) => ({
        salesUserId: row.salesUserId,
        name: users.find((user) => user.id === row.salesUserId)?.name,
        orderCount: row._count.id,
        totalAmount: Number(row._sum.amount || 0),
        paidAmount: Number(row._sum.paidAmount || 0),
      })),
      paymentTotal: Number(payments._sum.amount || 0),
    });
  } catch (error) {
    return apiError(error);
  }
}
