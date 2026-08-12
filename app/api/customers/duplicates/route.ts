import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, fail, apiError } from "@/lib/api";
import { normalizeCustomerField } from "@/lib/customer";

export async function GET(req: Request) {
  try {
    await requirePermission("customer:view");
    const query = new URL(req.url).searchParams.get("q")?.trim() || "";
    if (query.length < 2) return fail("至少输入 2 个字符进行查重", "QUERY_TOO_SHORT");
    const normalized = normalizeCustomerField(query);
    const items = await db.customer.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { contact: { contains: query, mode: "insensitive" } },
          { phone: { contains: query } },
          { contactInfo: { contains: query, mode: "insensitive" } },
          { address: { contains: query, mode: "insensitive" } },
          { contactMethods: { some: { OR: [
            { value: { contains: query, mode: "insensitive" } },
            { normalized: { contains: normalized } },
          ] } } },
        ],
      },
      select: {
        id: true,
        name: true,
        contact: true,
        phone: true,
        contactInfo: true,
        address: true,
        owner: { select: { name: true } },
        contactMethods: { select: { label: true, value: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });
    return ok(items);
  } catch (error) {
    return apiError(error);
  }
}
