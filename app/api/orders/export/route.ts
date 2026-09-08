import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api";
import { csvResponse } from "@/lib/csv";
import { businessLineText } from "@/lib/customer-labels";
import { approvalStatusText, businessOrderStatus } from "@/lib/order-workflow";
import { orderWhere } from "@/lib/order-query";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const where = orderWhere(user, params, new Date(), "empty");
    const items = await db.order.findMany({ where, include: { customer: true, salesUser: true, contract: true, receivable: true }, orderBy: { createdAt: "desc" } });
    return csvResponse(`订单管理-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["订单号", "合同编号", "订单名称", "订单归属", "客户名称", "业务类型", "销售人员", "合同金额", "产品合计", "技术支持费用", "外包费用", "评审费用", "其他支出", "净签单金额", "合同状态", "签订日期", "审核状态", "订单状态", "应收金额", "预计回款日期", "已收金额", "备注", "创建时间"],
      ...items.map((item) => [item.orderNumber, item.contract.contractNumber, item.name, item.category === "OCCUPATIONAL_HEALTH" ? "职业卫生" : "心邀环境", item.customer.name, businessLineText[item.contract.businessType], item.salesUser.name, item.amount, item.contract.productTotal, item.contract.technicalSupportFee, item.contract.outsourcingFee, item.contract.reviewFee, item.contract.otherExpense, item.contract.netOrderAmount, item.contract.signingStatus === "SIGNED" ? "已签订" : "待签订", item.contract.contractDate, approvalStatusText[item.approvalStatus], businessOrderStatus(item), item.receivable?.amount, item.receivable?.expectedDate, item.paidAmount, item.remark, item.createdAt]),
    ]);
  } catch (error) { return apiError(error); }
}
