import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { currentWorkInfo, fullWorkYears } from "@/lib/work-years";
import { nextEmployeeNumber } from "@/lib/employee-number";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

const schema = z.object({
  name: z.string().min(2),
  username: z.string().min(3),
  password: z.string().min(8),
  phone: z.string().regex(/^1\d{10}$/),
  departmentId: z.string().nullable(),
  roleId: z.string(),
  jobTitle: z.string().min(2),
  employmentStartDate: z.coerce.date(),
});

export async function GET() {
  try {
    await requirePermission("user:manage");
    const users = await db.user.findMany({
      select: { id: true, name: true, username: true, employeeNumber: true, phone: true, status: true, jobTitle: true, employmentStartDate: true, annualLeaveUsed: true, department: true, role: true },
      orderBy: { createdAt: "desc" },
    });
    return ok(users.map((user) => ({ ...user, ...currentWorkInfo(user.employmentStartDate) })));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requirePermission("user:manage");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0].message, "VALIDATION_ERROR");
    if (fullWorkYears(parsed.data.employmentStartDate) < 0)
      return fail("入职时间不能晚于今天", "INVALID_EMPLOYMENT_DATE", 400);
    const [role, department] = await Promise.all([
      db.role.findUnique({ where: { id: parsed.data.roleId } }),
      parsed.data.departmentId ? db.department.findUnique({ where: { id: parsed.data.departmentId } }) : null,
    ]);
    if (!role || role.code === "ADMIN" || !department || !role.code.startsWith(department.code))
      return fail("部门与角色不匹配", "ROLE_DEPARTMENT_MISMATCH");
    const { password, ...rest } = parsed.data;
    const { workYears, annualLeaveDays } = currentWorkInfo(rest.employmentStartDate);
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.$transaction(async (tx) => {
      const employeeNumber = await nextEmployeeNumber(tx, department.code);
      const item = await tx.user.create({
        data: { ...rest, employeeNumber, workYears, annualLeaveDays, passwordHash },
      });
      await tx.operationLog.create({
        data: { userId: admin.id, action: "CREATE_USER", module: "USER", targetId: item.id, description: `创建员工 ${item.name}，自动生成工号 ${employeeNumber}` },
      });
      return item;
    });
    return ok({ id: user.id, name: user.name, username: user.username, employeeNumber: user.employeeNumber }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return fail("账号、手机号或自动生成的工号已经存在", "USER_EXISTS", 409);
    return apiError(error);
  }
}
