import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { Prisma } from "@prisma/client";
import { customerSchema } from "@/lib/customer-input";
import {
  normalizeCustomerContact,
  normalizeCustomerField,
  normalizeCustomerName,
  normalizeCustomerPhone,
} from "@/lib/customer";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requirePermission("customer:manage");
    const { id } = await params;
    const parsed = customerSchema.safeParse(await req.json());
    if (!parsed.success)
      return fail(parsed.error.issues[0].message, "VALIDATION_ERROR");
    const data = parsed.data;
    const existing = await db.customer.findUnique({
      where: { id },
      include: { collaborators: { select: { userId: true } } },
    });
    if (!existing) return fail("客户不存在", "NOT_FOUND", 404);
    const canEdit = user.role.code.startsWith("SALES") && (
      existing.ownerId === user.id ||
      existing.collaborators.some((item) => item.userId === user.id)
    );
    if (!canEdit) throw new Error("FORBIDDEN");
    const ownerId = existing.ownerId;
    const collaboratorIds = existing.ownerId === user.id
      ? [...new Set(data.collaboratorIds)].filter((value) => value !== ownerId)
      : existing.collaborators.map((item) => item.userId);
    const salesCount = await db.user.count({
      where: {
        id: { in: [ownerId, ...collaboratorIds] },
        status: "ACTIVE",
        role: { code: { in: ["SALES_MANAGER", "SALES_EMPLOYEE"] } },
      },
    });
    if (salesCount !== new Set([ownerId, ...collaboratorIds]).size)
      return fail("负责销售或协同销售不存在", "INVALID_SALES_USER");
    const duplicate = await db.customer.findFirst({
      where: {
        id: { not: id },
        OR: [
          { nameNormalized: normalizeCustomerName(data.name) },
          { contactNormalized: normalizeCustomerContact(data.contact) },
          { phoneNormalized: normalizeCustomerPhone(data.phone) },
          ...data.contactMethods.map((item) => ({
            contactMethods: { some: { normalized: normalizeCustomerField(item.value) } },
          })),
        ],
      },
      select: { id: true },
    });
    if (duplicate)
      return fail("已有客户包含相同名称、联系人或联系方式", "CUSTOMER_EXISTS", 409);
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
    const updated = await db.$transaction(async (tx) => {
      await tx.customerContactMethod.deleteMany({ where: { customerId: id } });
      await tx.customerCollaborator.deleteMany({ where: { customerId: id } });
      return tx.customer.update({
        where: { id },
        data: {
          ...customerData,
          ownerId,
          nameNormalized: normalizeCustomerName(data.name),
          contactNormalized: normalizeCustomerContact(data.contact),
          phoneNormalized: normalizeCustomerPhone(data.phone),
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
    });
    await db.operationLog.create({
      data: {
        userId: user.id,
        action: "UPDATE_CUSTOMER",
        module: "CUSTOMER",
        targetId: id,
        description: `修改客户：${updated.name}`,
      },
    });
    return ok(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return fail("该客户已经存在，请勿重复创建", "CUSTOMER_EXISTS", 409);
    return apiError(error);
  }
}
