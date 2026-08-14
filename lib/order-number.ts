import { NextResponse } from "next/server";
import { db } from "./db";

export async function findOrderByNumber(number: string, excludeId?: string) {
  return db.order.findFirst({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [
        { orderNumber: { equals: number, mode: "insensitive" } },
        { contract: { contractNumber: { equals: number, mode: "insensitive" } } },
      ],
    },
    select: {
      id: true,
      orderNumber: true,
      name: true,
      customer: { select: { name: true } },
      contract: { select: { contractNumber: true } },
    },
  });
}

export function duplicateOrderNumberResponse(
  order: NonNullable<Awaited<ReturnType<typeof findOrderByNumber>>>,
) {
  return NextResponse.json(
    {
      success: false,
      code: "CONTRACT_NUMBER_EXISTS",
      message: "已有该合同编号",
      data: {
        id: order.id,
        orderNumber: order.orderNumber || order.contract.contractNumber,
        name: order.name,
        customerName: order.customer.name,
      },
    },
    { status: 409 },
  );
}
