import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, fail, apiError } from "@/lib/api";
import { Prisma } from "@prisma/client";
import { customerSchema } from "@/lib/customer-input";
import {
  normalizeCustomerContact,
  normalizeCustomerField,
  normalizeCustomerName,
  normalizeCustomerPhone,
} from "@/lib/customer";
import { customerAccessWhere } from "@/lib/customer-access";

function duplicateTerms(data: {
  name: string;
  contact: string;
  phone: string;
  contactInfo?: string;
  contactMethods: { value: string }[];
}) {
  return [...new Set([
    normalizeCustomerField(data.name),
    normalizeCustomerField(data.contact),
    normalizeCustomerField(data.phone),
    ...(data.contactInfo ? [normalizeCustomerField(data.contactInfo)] : []),
    ...data.contactMethods.map((item) => normalizeCustomerField(item.value)),
  ].filter(Boolean))];
}

async function findDuplicates(
  data: Parameters<typeof duplicateTerms>[0],
  client: Pick<typeof db, "customer"> = db,
) {
  const terms = duplicateTerms(data);
  return client.customer.findMany({
    where: {
      OR: [
        { nameNormalized: { in: terms } },
        { contactNormalized: { in: terms } },
        { phoneNormalized: { in: terms } },
        ...terms.flatMap((term) => [
          { contactInfo: { contains: term, mode: "insensitive" as const } },
          { contactMethods: { some: { normalized: term } } },
        ]),
      ],
    },
    select: {
      id: true,
      name: true,
      contact: true,
      phone: true,
      contactInfo: true,
      owner: { select: { name: true } },
      contactMethods: { select: { label: true, value: true } },
    },
    take: 10,
    orderBy: { updatedAt: "desc" },
  });
}

export async function GET(req: Request) {
  try {
    const user = await requirePermission("customer:view");
    const params = new URL(req.url).searchParams;
    const search = params.get("search")?.trim() || "";
    const page = Math.max(1, Number(params.get("page") || 1));
    const pageSize = Math.min(50, Math.max(1, Number(params.get("pageSize") || 20)));
    const access = customerAccessWhere(user);
    const searchWhere = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { contact: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search } },
            { contactInfo: { contains: search, mode: "insensitive" as const } },
            { contactMethods: { some: { value: { contains: search, mode: "insensitive" as const } } } },
          ],
        }
      : {};
    const where = { AND: [access, searchWhere] };
    const [items, total] = await Promise.all([
      db.customer.findMany({
        where,
        include: {
          owner: { select: { name: true } },
          collaborators: { include: { user: { select: { id: true, name: true } } } },
          contactMethods: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.customer.count({ where }),
    ]);
    return ok({ items, total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requirePermission("customer:create");
    const parsed = customerSchema.safeParse(await req.json());
    if (!parsed.success)
      return fail(parsed.error.issues[0].message, "VALIDATION_ERROR");
    const data = parsed.data;
    const ownerId = user.role.code === "ADMIN" || user.role.code === "SALES_MANAGER"
      ? data.salesUserId || user.id
      : user.id;
    const sales = await db.user.findFirst({
      where: {
        id: ownerId,
        status: "ACTIVE",
        role: { code: { in: ["SALES_MANAGER", "SALES_EMPLOYEE"] } },
      },
    });
    if (!sales) return fail("负责销售不存在或已停用", "INVALID_SALES_USER");
    const collaboratorIds = [...new Set(data.collaboratorIds)].filter((id) => id !== ownerId);
    if (collaboratorIds.length) {
      const count = await db.user.count({
        where: {
          id: { in: collaboratorIds },
          status: "ACTIVE",
          role: { code: { in: ["SALES_MANAGER", "SALES_EMPLOYEE"] } },
        },
      });
      if (count !== collaboratorIds.length)
        return fail("协同销售不存在或已停用", "INVALID_COLLABORATOR");
    }
    const duplicates = await findDuplicates(data);
    if (duplicates.length)
      return fail(JSON.stringify(duplicates), "CUSTOMER_DUPLICATES", 409);

    const customerData = {
      name: data.name,
      contact: data.contact,
      phone: data.phone,
      address: data.address,
      contactInfo: data.contactInfo,
      remark: data.remark,
      businessLine: data.businessLine,
      monitoringType: data.monitoringType,
      industry: data.industry,
      status: data.status,
      nature: data.nature,
    };
    const contactMethods = data.contactMethods;
    const customer = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('customer-create'))`;
      const recheck = await findDuplicates(data, tx);
      if (recheck.length) throw new Error("CUSTOMER_EXISTS");
      return tx.customer.create({
        data: {
          ...customerData,
          nameNormalized: normalizeCustomerName(data.name),
          contactNormalized: normalizeCustomerContact(data.contact),
          phoneNormalized: normalizeCustomerPhone(data.phone),
          ownerId,
          createdById: user.id,
          contactMethods: {
            create: [
              { label: "电话", value: data.phone, normalized: normalizeCustomerField(data.phone) },
              ...(data.contactInfo ? [{ label: "其他联系信息", value: data.contactInfo, normalized: normalizeCustomerField(data.contactInfo) }] : []),
              ...contactMethods.map((item) => ({
                label: item.label,
                value: item.value,
                normalized: normalizeCustomerField(item.value),
              })),
            ],
          },
          collaborators: { create: collaboratorIds.map((userId) => ({ userId })) },
        },
      });
    }, { maxWait: 5000, timeout: 15000 });
    await db.operationLog.create({
      data: {
        userId: user.id,
        action: "CREATE_CUSTOMER",
        module: "CUSTOMER",
        targetId: customer.id,
        description: `创建客户：${customer.name}，负责销售：${sales.name}`,
      },
    });
    return ok(customer, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "CUSTOMER_EXISTS")
      return fail("数据库中已有重复客户，请使用查重功能查看", "CUSTOMER_EXISTS", 409);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return fail("该客户已经存在，请勿重复创建", "CUSTOMER_EXISTS", 409);
    return apiError(error);
  }
}
