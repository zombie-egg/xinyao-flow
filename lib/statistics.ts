import type { Prisma } from "@prisma/client";

export function statisticsDateRange(start?: string, end?: string) {
  return {
    start: start ? new Date(`${start}T00:00:00+08:00`) : undefined,
    end: end ? new Date(`${end}T23:59:59.999+08:00`) : undefined,
  };
}

export function statisticsOrderWhere({
  start,
  end,
  salesUserId,
}: {
  start?: Date;
  end?: Date;
  salesUserId?: string;
}): Prisma.OrderWhereInput {
  return {
    approvalStatus: "APPROVED",
    status: { not: "CANCELLED" },
    ...(salesUserId ? { salesUserId } : {}),
    ...(start || end
      ? {
          contract: {
            contractDate: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lte: end } : {}),
            },
          },
        }
      : {}),
  };
}
