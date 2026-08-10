import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Empty } from "@/components/page";
import { EmployeeManager } from "@/components/employee-manager";
import { currentWorkInfo } from "@/lib/work-years";
import { SearchForm } from "@/components/search-form";
const departments = [
  ["FINANCE", "财务部"],
  ["SALES", "销售部"],
  ["TECH", "技术部"],
] as const;
export default async function Employees({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; department?: string }>;
}) {
  const viewer = await requireUser(),
    admin = viewer.role.code === "ADMIN",
    manager =
      viewer.role.code === "SALES_MANAGER" ||
      viewer.role.code === "TECH_MANAGER";
  if (!admin && !manager) throw new Error("FORBIDDEN");
  const params = await searchParams,
    q = params.q?.trim() || "",
    department = departments.some(([code]) => code === params.department)
      ? (params.department as "FINANCE" | "SALES" | "TECH")
      : "FINANCE",
    [users, counts] = await Promise.all([
      db.user.findMany({
        where: {
          ...(admin
            ? { department: { code: department } }
            : { departmentId: viewer.departmentId }),
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { username: { contains: q, mode: "insensitive" } },
                  { employeeNumber: { contains: q, mode: "insensitive" } },
                  { phone: { contains: q } },
                  { jobTitle: { contains: q, mode: "insensitive" } },
                  { role: { name: { contains: q, mode: "insensitive" } } },
                ],
              }
            : {}),
        },
        include: { role: true, department: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      admin
        ? Promise.all(
            departments.map(([code]) =>
              db.user.count({ where: { department: { code } } }),
            ),
          )
        : Promise.resolve([]),
    ]),
    mapped = users.map((x) => ({
      ...x,
      ...currentWorkInfo(x.employmentStartDate),
      employmentStartDate: x.employmentStartDate.toISOString(),
      annualLeaveUsed: Number(x.annualLeaveUsed),
    })),
    currentName = admin
      ? departments.find(([code]) => code === department)?.[1] || "财务部"
      : viewer.department?.name || "本部门",
    suffix = q ? `&q=${encodeURIComponent(q)}` : "";
  return (
    <>
      <PageHeader
        title="员工管理"
        description={
          admin
            ? "财务、销售和技术部门分别管理；管理员可编辑工号和入职时间"
            : "查看本部门员工和考勤详情，部门经理没有编辑权限"
        }
      />
      {admin && (
        <div className="mb-5 flex flex-wrap gap-2">
          {departments.map(([code, name], index) => (
            <Link
              key={code}
              href={`/employees?department=${code}${suffix}`}
              className={`rounded-lg px-5 py-3 text-sm font-medium ${department === code ? "bg-zinc-950 text-white" : "border bg-white text-zinc-600"}`}
            >
              {name}{" "}
              <span
                className={
                  department === code ? "text-zinc-300" : "text-zinc-400"
                }
              >
                {counts[index]} 人
              </span>
            </Link>
          ))}
        </div>
      )}
      <SearchForm
        defaultValue={q}
        placeholder="搜索姓名、账号、工号、电话、角色或职位"
        hidden={admin ? { department } : undefined}
        clearHref={admin ? `/employees?department=${department}` : "/employees"}
      />
      <h2 className="mb-3 font-medium">
        {currentName}{" "}
        <span className="text-sm font-normal text-zinc-400">
          {users.length} 人
        </span>
      </h2>
      {mapped.length ? (
        <EmployeeManager users={mapped} canEdit={admin} />
      ) : (
        <Empty
          text={q ? `没有匹配的${currentName}员工` : `${currentName}暂无员工`}
        />
      )}
    </>
  );
}
