import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api";
import { customerAccessWhere } from "@/lib/customer-access";
import { businessLineText, customerStatusText } from "@/lib/customer-labels";
import { csvResponse } from "@/lib/csv";

export async function GET() {
  try {
    const user = await requirePermission("customer:view");
    const items = await db.customer.findMany({ where: customerAccessWhere(user), include: { owner: true, collaborators: { include: { user: true } }, contactMethods: true }, orderBy: { createdAt: "desc" } });
    return csvResponse(`客户管理-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["客户名称", "业务线", "检测类型", "客户行业", "客户状态", "客户性质", "联系人", "联系电话", "其他联系方式", "地址", "负责销售", "协同销售", "客户归属", "备注", "创建时间", "更新时间"],
      ...items.map((item) => [item.name, businessLineText[item.businessLine], item.monitoringType, item.industry, customerStatusText[item.status], item.nature, item.contact, item.phone, item.contactMethods.map((x) => `${x.label || "其他"}:${x.value}`).join("；"), item.address, item.owner?.name, item.collaborators.map((x) => x.user.name).join("、"), item.isPublicPool ? "公海客户" : "跟进客户", item.remark, item.createdAt, item.updatedAt]),
    ]);
  } catch (error) { return apiError(error); }
}
