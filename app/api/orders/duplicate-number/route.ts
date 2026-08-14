import { requireUser } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { findOrderByNumber } from "@/lib/order-number";

export async function GET(req: Request) {
  try {
    await requireUser();
    const params = new URL(req.url).searchParams;
    const number = params.get("number")?.trim();
    if (!number) return fail("请输入合同编号", "VALIDATION_ERROR");
    const excludeId = params.get("excludeId") || undefined;
    return ok(await findOrderByNumber(number, excludeId));
  } catch (error) {
    return apiError(error);
  }
}
