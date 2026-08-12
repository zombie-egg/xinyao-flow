import { LoginForm } from "@/components/login-form";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const company = await db.companySetting.findUnique({
    where: { id: "company" },
    select: { companyName: true, logoUrl: true },
  });
  return (
    <LoginForm
      companyName={company?.companyName || "企业"}
      logoUrl={company?.logoUrl || null}
    />
  );
}
