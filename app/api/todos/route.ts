import { requireUser } from "@/lib/auth";
import { todoCounts } from "@/lib/todo-counts";
import { ok, apiError } from "@/lib/api";
export async function GET() {
  try {
    return ok(await todoCounts(await requireUser()));
  } catch (e) {
    return apiError(e);
  }
}
