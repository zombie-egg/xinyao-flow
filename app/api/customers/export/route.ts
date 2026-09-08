import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api";
import { businessLineText, customerStatusText } from "@/lib/customer-labels";
import { csvResponse } from "@/lib/csv";
import { customerWhere } from "@/lib/customer-query";

export async function GET(request: Request) {
  try {
    const user = await requirePermission("customer:view");
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const items = await db.customer.findMany({ where: customerWhere(user, params), include: { owner: true, collaborators: { include: { user: true } }, contactMethods: true }, orderBy: { createdAt: "desc" } });
    return csvResponse(`客户管理-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["客户名称", "客户模板", "业务线", "检测类型", "客户行业", "客户状态", "客户性质", "联系人", "联系电话", "其他联系方式", "地址", "负责销售", "协同销售", "客户归属", "备注", "创建时间", "更新时间"],
      ...items.map((item) => [item.name, item.category === "OCCUPATIONAL_HEALTH" ? "职业卫生" : "心邀环境", businessLineText[item.businessLine], item.monitoringType, item.industry, customerStatusText[item.status], item.nature, item.contact, item.phone, item.contactMethods.map((x) => `${x.label || "其他"}:${x.value}`).join("；"), item.address, item.owner?.name, item.collaborators.map((x) => x.user.name).join("、"), item.isPublicPool ? "公海客户" : "跟进客户", item.remark, item.createdAt, item.updatedAt]),
    ]);
  } catch (error) { return apiError(error); }
}
