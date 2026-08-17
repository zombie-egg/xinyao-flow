import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { cachedCompanySetting } from "@/lib/cached-data";
export default async function Portal({
  children,
}: {
  children: React.ReactNode;
}) {
  const u = await requireUser(),
    company = await cachedCompanySetting();
  return (
    <>
      <Sidebar
        badges={{}}
        company={{
          name: company?.companyName || "企业",
          logoUrl: company?.logoUrl || null,
        }}
        user={{
          name: u.name,
          avatarUrl: u.avatarUrl,
          jobTitle: u.jobTitle,
          role: u.role.code,
          permissions:
            u.role.code === "ADMIN"
              ? [
                  "dashboard:view",
                  "attendance:self",
                  "attendance:all",
                  "leave:create",
                  "approval:all",
                  "contract:all",
                  "order:finance",
                  "statistics:view",
                  "user:manage",
                  "settings:manage",
                  "logs:view",
                ]
              : u.role.permissions.map((x) => x.permission.code),
        }}
      />
      <main className="min-h-screen p-5 pt-20 lg:ml-64 lg:p-8">{children}</main>
    </>
  );
}
