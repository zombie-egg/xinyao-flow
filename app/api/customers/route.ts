import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, fail, apiError } from "@/lib/api";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { normalizeCustomerName, normalizeCustomerPhone } from "@/lib/customer";
const schema = z.object({
  name: z.string().trim().min(2).max(100),
  contact: z.string().trim().min(2).max(50),
  phone: z.string().trim().min(5).max(30),
  address: z.string().trim().max(300).optional(),
  contactInfo: z.string().trim().max(300).optional(),
  remark: z.string().trim().max(1000).optional(),
  salesUserId: z.string().trim().optional(),
});
export async function GET(req: Request) {
  try {
    await requirePermission("customer:view");
    const q = new URL(req.url).searchParams,
      search = q.get("search")?.trim() || "",
      page = Math.max(1, Number(q.get("page") || 1)),
      pageSize = Math.min(50, Math.max(1, Number(q.get("pageSize") || 20))),
      where = search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { contact: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search } },
            ],
          }
        : {};
    const [items, total] = await Promise.all([
      db.customer.findMany({
        where,
        include: { owner: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.customer.count({ where }),
    ]);
    return ok({ items, total, page, pageSize });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    const u = await requirePermission("customer:create"),
      p = schema.safeParse(await req.json());
    if (!p.success) return fail(p.error.issues[0].message, "VALIDATION_ERROR");
    const { salesUserId, ...data } = p.data,
      ownerId = u.role.code === "ADMIN" ? salesUserId : u.id;
    if (!ownerId) return fail("请选择负责销售", "SALES_USER_REQUIRED");
    const sales = await db.user.findFirst({
      where: {
        id: ownerId,
        status: "ACTIVE",
        role: { code: { in: ["SALES_MANAGER", "SALES_EMPLOYEE"] } },
      },
    });
    if (!sales) return fail("负责销售不存在或已停用", "INVALID_SALES_USER");
    const c = await db.customer.create({
      data: {
        ...data,
        nameNormalized: normalizeCustomerName(data.name),
        phoneNormalized: normalizeCustomerPhone(data.phone),
        ownerId,
      },
    });
    await db.operationLog.create({
      data: {
        userId: u.id,
        action: "CREATE_CUSTOMER",
        module: "CUSTOMER",
        targetId: c.id,
        description: `创建客户：${c.name}，负责销售：${sales.name}`,
      },
    });
    return ok(c, 201);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return fail("该客户已经存在，请勿重复创建", "CUSTOMER_EXISTS", 409);
    return apiError(e);
  }
}
