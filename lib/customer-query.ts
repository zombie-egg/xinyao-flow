import type { Prisma, RoleCode } from "@prisma/client";
import { customerAccessWhere } from "./customer-access";
import { flexiblePeriodRange } from "./period-range";

type CustomerQueryUser = { id: string; role: { code: RoleCode } };

export function customerWhere(
  user: CustomerQueryUser,
  params: Record<string, string | undefined>,
  now = new Date(),
): Prisma.CustomerWhereInput {
  const todayStart = new Date(now.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }) + "T00:00:00+08:00");
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const createdRange = flexiblePeriodRange(params.createdFromMode, params.createdFromValue, params.createdToMode, params.createdToValue);
  const updatedRange = flexiblePeriodRange(params.updatedFromMode, params.updatedFromValue, params.updatedToMode, params.updatedToValue);
  const q = params.q?.trim() || "";

  return { AND: [
    customerAccessWhere(user),
    params.category ? { category: params.category as "XINYAO_ENVIRONMENT" | "OCCUPATIONAL_HEALTH" } : {},
    params.ownership === "PUBLIC" ? { isPublicPool: true } : params.ownership === "TRACKED" ? { isPublicPool: false } : {},
    params.quick === "today" ? { createdAt: { gte: todayStart } } : params.quick === "week" ? { createdAt: { gte: weekStart } } : params.quick === "mine" ? { isPublicPool: false, ownerId: user.id } : params.quick === "collaborative" ? { isPublicPool: false, collaborators: { some: { userId: user.id } } } : params.quick === "public" ? { isPublicPool: true } : {},
    q ? { OR: [
      { name: { contains: q, mode: "insensitive" } },
      { contact: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { industry: { contains: q, mode: "insensitive" } },
      { contactInfo: { contains: q, mode: "insensitive" } },
      { pendingOwnerName: { contains: q, mode: "insensitive" } },
      { owner: { is: { name: { contains: q, mode: "insensitive" } } } },
      { collaborators: { some: { user: { name: { contains: q, mode: "insensitive" } } } } },
      { contactMethods: { some: { value: { contains: q, mode: "insensitive" } } } },
    ] } : {},
    params.customerName ? { name: { contains: params.customerName, mode: "insensitive" } } : {},
    params.contactQuery ? { contact: { contains: params.contactQuery, mode: "insensitive" } } : {},
    params.phoneQuery ? { phone: { contains: params.phoneQuery } } : {},
    params.collaboratorId ? { collaborators: { some: { userId: params.collaboratorId } } } : {},
    params.customerStatus ? { status: params.customerStatus as "POTENTIAL" | "INITIAL_CONTACT" | "FOLLOWING" | "WON" | "LOYAL" } : {},
    params.nature ? { nature: params.nature } : {},
    params.ownerId ? { OR: [{ ownerId: params.ownerId }, { collaborators: { some: { userId: params.ownerId } } }] } : {},
    params.businessLine ? { businessLine: params.businessLine as "ENVIRONMENTAL_MONITORING" | "PUBLIC_HEALTH" | "OCCUPATIONAL_HEALTH" } : {},
    params.industry ? { industry: { contains: params.industry, mode: "insensitive" } } : {},
    createdRange ? { createdAt: createdRange } : {},
    updatedRange ? { updatedAt: updatedRange } : {},
  ] };
}
