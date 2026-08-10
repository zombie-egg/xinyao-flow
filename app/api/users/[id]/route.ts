import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { fullWorkYears } from "@/lib/work-years";
import { z } from "zod";
import { Prisma } from "@prisma/client";
const schema = z.object({
  employmentStartDate: z.coerce.date(),
  employeeNumber: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(
      z
        .string()
        .regex(
          /^XY(CW|XS|JS)\d{2,}$/,
          "工号格式应为 XYCW、XYXS 或 XYJS 后跟数字，例如 XYXS01",
        ),
    ),
});
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requirePermission("user:manage");
    if (admin.role.code !== "ADMIN")
      return fail("只有管理员可以修改员工工号和入职时间", "FORBIDDEN", 403);
    const { id } = await params,
      p = schema.safeParse(await req.json());
    if (!p.success) return fail(p.error.issues[0].message, "VALIDATION_ERROR");
    const existing = await db.user.findUnique({
      where: { id },
      include: { department: true },
    });
    if (!existing) return fail("员工不存在", "NOT_FOUND", 404);
    const expectedPrefix =
      existing.department?.code === "FINANCE"
        ? "XYCW"
        : existing.department?.code === "SALES"
          ? "XYXS"
          : existing.department?.code === "TECH"
            ? "XYJS"
            : null;
    if (!expectedPrefix || !p.data.employeeNumber.startsWith(expectedPrefix))
      return fail(
        `该员工工号必须以 ${expectedPrefix || "对应部门前缀"} 开头`,
        "INVALID_EMPLOYEE_NUMBER",
        400,
      );
    const workYears = fullWorkYears(p.data.employmentStartDate);
    if (workYears < 0)
      return fail("入职时间不能晚于今天", "INVALID_EMPLOYMENT_DATE", 400);
    if (workYears < Number(existing.annualLeaveUsed))
      return fail(
        `入职时间对应年假不能少于已使用年假（${Number(existing.annualLeaveUsed)} 天）`,
        "ANNUAL_LEAVE_USED_EXCEEDS_TOTAL",
        409,
      );
    const updated = await db.user.update({
      where: { id },
      data: {
        employmentStartDate: p.data.employmentStartDate,
        employeeNumber: p.data.employeeNumber,
        workYears,
        annualLeaveDays: workYears,
      },
    });
    await db.operationLog.create({
      data: {
        userId: admin.id,
        action: "UPDATE_USER_WORK_INFO",
        module: "USER",
        targetId: id,
        description: `更新员工 ${updated.name} 的工号和入职时间，系统自动计算工龄和年假`,
      },
    });
    return ok({
      id: updated.id,
      name: updated.name,
      employmentStartDate: updated.employmentStartDate,
      workYears: updated.workYears,
      annualLeaveDays: updated.annualLeaveDays,
      employeeNumber: updated.employeeNumber,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return fail("该工号已经存在", "EMPLOYEE_NUMBER_EXISTS", 409);
    return apiError(e);
  }
}
