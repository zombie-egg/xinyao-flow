import type { RoleCode } from "@prisma/client";

export function canViewAllCustomers(role: RoleCode) {
  return role === "ADMIN" || role === "SALES_MANAGER" || role.startsWith("FINANCE");
}

export function hasSalesCapabilities(role: RoleCode) {
  return role === "ADMIN" || role.startsWith("SALES");
}

export function customerAccessWhere(user: {
  id: string;
  role: { code: RoleCode };
}) {
  return canViewAllCustomers(user.role.code)
    ? {}
    : user.role.code === "SALES_EMPLOYEE"
      ? {
          OR: [
            { isPublicPool: true },
            { ownerId: user.id },
            { collaborators: { some: { userId: user.id } } },
          ],
        }
      : { id: "__NO_CUSTOMER_ACCESS__" };
}

export function customerBusinessAccess(customer: {
  ownerId: string | null;
  isPublicPool?: boolean;
  collaborators: { userId: string }[];
}, userId: string) {
  return (
    !customer.isPublicPool && (customer.ownerId === userId ||
    customer.collaborators.some((item) => item.userId === userId)
    )
  );
}

export function canEditCustomerProfile(
  role: RoleCode,
  customer: {
    ownerId: string | null;
    isPublicPool?: boolean;
    collaborators: { userId: string }[];
  },
  userId: string,
) {
  if (customer.isPublicPool) return false;
  return (
    role === "ADMIN" ||
    role === "SALES_MANAGER" ||
    customerBusinessAccess(customer, userId)
  );
}

export function canOperateCustomerSalesFlow(
  role: RoleCode,
  customer: {
    ownerId: string | null;
    isPublicPool?: boolean;
    collaborators: { userId: string }[];
  },
  userId: string,
) {
  return hasSalesCapabilities(role) && customerBusinessAccess(customer, userId);
}
