import { unstable_cache } from "next/cache";
import { db } from "./db";

export const cachedCompanySetting = unstable_cache(
  () => db.companySetting.findUnique({ where: { id: "company" } }),
  ["company-setting"],
  { revalidate: 300 },
);

export const cachedSalesUsers = unstable_cache(
  () => db.user.findMany({
    where: { status: "ACTIVE", role: { code: { in: ["ADMIN", "SALES_MANAGER", "SALES_EMPLOYEE"] } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  }),
  ["active-sales-users"],
  { revalidate: 60 },
);
