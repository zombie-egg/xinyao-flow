import type { DepartmentCode, Prisma } from "@prisma/client";

const prefixes: Record<DepartmentCode, string> = {
  FINANCE: "XYCW",
  SALES: "XYXS",
  TECH: "XYJS",
};

export async function nextEmployeeNumber(
  tx: Prisma.TransactionClient,
  departmentCode: DepartmentCode,
) {
  const prefix = prefixes[departmentCode];
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`employee-number-${prefix}`}))`;
  const existing = await tx.user.findMany({
    where: { employeeNumber: { startsWith: prefix } },
    select: { employeeNumber: true },
  });
  const used = new Set(
    existing.flatMap(({ employeeNumber }) => {
      const suffix = employeeNumber?.slice(prefix.length);
      return suffix && /^\d+$/.test(suffix) ? [Number(suffix)] : [];
    }),
  );
  let sequence = 1;
  while (used.has(sequence)) sequence += 1;
  return `${prefix}${String(sequence).padStart(2, "0")}`;
}
