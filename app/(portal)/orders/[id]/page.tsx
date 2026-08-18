import { hasSalesCapabilities } from "@/lib/customer-access";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { money, dateTime } from "@/lib/utils";
import {
  approvalStatusText,
  businessOrderStatus,
  processStatusText,
  technicalStatusText,
} from "@/lib/order-workflow";
import {
  ReviewActions,
  TechnicalActions,
  InvoiceForm,
  InvoiceApplicationForm,
  PaymentForm,
  RejectedOrderActions,
  ContractSigningStatusAction,
} from "@/components/order-actions";
export default async function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const u = await requireUser(),
    { id } = await params,
    order = await db.order.findUnique({
      where: { id },
      include: {
        customer: { include: { collaborators: { include: { user: true } } } },
        salesUser: true,
        technicalUser: true,
        financeUser: true,
        contract: {include:{signer:true,responsibleUser:true,collaborator:true}},
        invoice: true,
        receivable: {
          include: { responsibleUser: true, collaboratorUser: true },
        },
        payments: {
          include: { financeUser: true },
          orderBy: { createdAt: "asc" },
        },
        approvals: {
          include: { approver: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  if (!order) notFound();
  const historicalOnly = Boolean(order.historicalSalesName);
  const canSee =
    u.role.code === "ADMIN" ||
    u.role.code.startsWith("FINANCE") ||
    (u.role.code === "TECH_MANAGER" && !historicalOnly && order.approvalStatus === "APPROVED") ||
    (u.role.code === "TECH_EMPLOYEE" && !historicalOnly && order.technicalUserId === u.id) ||
    (u.role.code === "SALES_EMPLOYEE" && (order.salesUserId === u.id || order.customer.ownerId === u.id || order.customer.collaborators.some((item) => item.userId === u.id))) ||
    (u.role.code === "SALES_MANAGER" &&
      order.salesUser.departmentId === u.departmentId);
  if (!canSee) throw new Error("FORBIDDEN");
  const logs = await db.operationLog.findMany({
      where: { module: "ORDER", targetId: id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    remaining =
      Number(order.receivable?.amount || order.amount) - Number(order.paidAmount),
    canManager =
      u.role.code === "SALES_MANAGER" &&
      order.approvalStatus === "PENDING_SALES_MANAGER" &&
      u.departmentId === order.salesUser.departmentId,
    canFinance =
      u.role.code.startsWith("FINANCE") &&
      order.approvalStatus === "PENDING_FINANCE",
    canAdmin =
      u.role.code === "ADMIN" && order.approvalStatus === "PENDING_ADMIN",
    canSalesOperate = !historicalOnly && hasSalesCapabilities(u.role.code) && (order.salesUserId === u.id || order.customer.collaborators.some((item) => item.userId === u.id)),
    canChangeSigningStatus = hasSalesCapabilities(u.role.code) && (order.salesUserId === u.id || order.contract.responsibleUserId === u.id || order.contract.signerId === u.id);
  return (
    <>
      <PageHeader
        title={order.orderNumber ? `订单 ${order.orderNumber}` : "待审核订单"}
        description={order.name}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <h2 className="font-medium">客户信息</h2>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              ["客户名称", order.customer.name],
              ["联系人", order.contact || order.customer.contact],
              ["联系电话", order.phone || order.customer.phone],
              ["地址", order.address || order.customer.address || "—"],
              [
                "其他联系方式",
                order.contactInfo || order.customer.contactInfo || "—",
              ],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-6">
                <dt className="text-zinc-500">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          <h2 className="font-medium">订单信息</h2>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              ["订单号", order.orderNumber || "管理员审核后生成"],
              ["订单金额", money(Number(order.amount))],
              ["创建时间", dateTime(order.createdAt)],
              ["销售人员", order.historicalSalesName || order.salesUser.name],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-6">
                <dt className="text-zinc-500">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge>{approvalStatusText[order.approvalStatus]}</Badge>
            <Badge
              className={
                order.status === "COMPLETED" ? "bg-red-50 text-red-600" : ""
              }
            >
              {businessOrderStatus(order)}
            </Badge>
            <Badge>{technicalStatusText[order.technicalStatus]}</Badge>
          </div>
        </Card>
        <Card>
          <h2 className="font-medium">项目需求</h2>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
            {order.projectRequirements}
          </p>
          {order.remark && (
            <p className="mt-4 border-t pt-4 text-sm text-zinc-500">
              备注：{order.remark}
            </p>
          )}
        </Card>
        <Card>
          <h2 className="font-medium">合同文件</h2>
          <p className="mt-3 text-sm text-zinc-500">
            合同编号：{order.contract.contractNumber || "全部审批后生成"}
          </p>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {[['业务类型',order.contract.businessType==='PUBLIC_HEALTH'?'公共卫生':'环境检测'],['合同状态',order.contract.signingStatus==='SIGNED'?'已签署':'待签署'],['产品合计',money(Number(order.contract.productTotal))],['合同金额',money(Number(order.contract.amount))],['技术支持费用',money(Number(order.contract.technicalSupportFee))],['外包费用',money(Number(order.contract.outsourcingFee))],['评审费用',money(Number(order.contract.reviewFee))],['其他支出',money(Number(order.contract.otherExpense))],['净签单金额',money(Number(order.contract.netOrderAmount))],['变更净签单金额',order.contract.adjustedNetAmount==null?'—':money(Number(order.contract.adjustedNetAmount))],['签订人',order.contract.historicalSalesName||order.contract.signer?.name||'—'],['签订日期',order.contract.contractDate.toLocaleDateString('zh-CN')],['负责人',order.contract.historicalSalesName||order.contract.responsibleUser?.name||'—'],['协同人',order.contract.collaborator?.name||'—']].map(([k,v])=><div key={k} className="flex justify-between gap-4"><span className="text-zinc-500">{k}</span><span className="text-right">{v}</span></div>)}
          </div>
          {order.contract.expenseDetails&&<p className="mt-4 whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-sm">费用明细备注：{order.contract.expenseDetails}</p>}
          {order.contract.originalExpenseNote&&<p className="mt-3 whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-sm">原技术支持/外包/评审费：{order.contract.originalExpenseNote}</p>}
          {canChangeSigningStatus && <ContractSigningStatusAction id={id} status={order.contract.signingStatus} />}
          {order.contract.fileUrl ? (
            <a
              href={order.contract.fileUrl}
              target="_blank"
              className="mt-4 inline-flex rounded-lg border px-4 py-2 text-sm font-medium"
            >
              查看或下载：{order.contract.fileName || "合同文件"}
            </a>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">未上传合同</p>
          )}
        </Card>
        <Card>
          <h2 className="font-medium">财务信息</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            {order.receivable && (
              <>
                <div>
                  <p className="text-zinc-500">应收编号</p>
                  <p className="mt-1 font-medium">{order.receivable.number}</p>
                </div>
                <div>
                  <p className="text-zinc-500">应收金额</p>
                  <p className="mt-1 font-medium">
                    {money(Number(order.receivable.amount))}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">预计回款日期</p>
                  <p className="mt-1 font-medium">
                    {order.receivable.expectedDate.toLocaleDateString("zh-CN")}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">回款类型</p>
                  <p className="mt-1 font-medium">
                    {order.receivable.paymentType || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">应收负责人</p>
                  <p className="mt-1 font-medium">
                    {order.receivable.responsibleUser.name}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">应收协同人</p>
                  <p className="mt-1 font-medium">
                    {order.receivable.collaboratorUser?.name || "—"}
                  </p>
                </div>
              </>
            )}
            <div>
              <p className="text-zinc-500">销售开票申请</p>
              <p className="mt-1 font-medium">
                {processStatusText[order.invoiceApplicationStatus]}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">发票状态</p>
              <p className="mt-1 font-medium">
                {processStatusText[order.invoiceStatus]}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">回款状态</p>
              <p className="mt-1 font-medium">
                {processStatusText[order.paymentStatus]}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">已回款金额</p>
              <p className="mt-1 font-medium">
                {money(Number(order.paidAmount))}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">剩余金额</p>
              <p className="mt-1 font-medium">{money(remaining)}</p>
            </div>
          </div>
          {order.invoiceApplicationFileUrl && (
            <a
              href={order.invoiceApplicationFileUrl}
              target="_blank"
              className="mt-4 inline-block text-sm underline"
            >
              查看销售上传的开票信息
            </a>
          )}
          {order.invoiceApplicationNote && (
            <p className="mt-3 whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-sm">
              开票备注：{order.invoiceApplicationNote}
            </p>
          )}
          {order.invoice?.fileUrl && (
            <a
              href={order.invoice.fileUrl}
              target="_blank"
              className="mt-4 inline-block text-sm underline"
            >
              查看发票文件
            </a>
          )}
          <div className="mt-4 space-y-2">
            {order.payments.map((p) => (
              <div key={p.id} className="rounded-lg bg-zinc-50 p-3 text-sm">
                {dateTime(p.createdAt)} · {money(Number(p.amount))} ·{" "}
                {p.financeUser?.name || "财务"}{" "}
                {p.receiptUrl && (
                  <a
                    href={p.receiptUrl}
                    target="_blank"
                    className="ml-2 underline"
                  >
                    查看票据
                  </a>
                )}
              </div>
            ))}
          </div>
        </Card>
        <Card id="invoice-application">
          <h2 className="font-medium">
            {canSalesOperate &&
            order.approvalStatus === "APPROVED" &&
            order.invoiceApplicationStatus === "PENDING"
              ? "申请开票"
              : "当前可执行操作"}
          </h2>
          <div className="mt-4">
            {canSalesOperate &&
              order.status !== "CANCELLED" &&
              ["MANAGER_REJECTED", "FINANCE_REJECTED", "ADMIN_REJECTED"].includes(
                order.approvalStatus,
              ) && <RejectedOrderActions id={id} />}{" "}
            {(canManager || canFinance || canAdmin) && (
              <ReviewActions id={id} />
            )}{" "}
            {!historicalOnly && u.role.code === "TECH_EMPLOYEE" &&
              order.technicalUserId === u.id &&
              order.approvalStatus === "APPROVED" && (
                <TechnicalActions id={id} status={order.technicalStatus} />
              )}{" "}
            {canSalesOperate &&
              order.approvalStatus === "APPROVED" &&
              order.invoiceApplicationStatus === "PENDING" && (
                <InvoiceApplicationForm id={id} />
              )}{" "}
            {!historicalOnly && u.role.code.startsWith("FINANCE") &&
              order.invoiceApplicationStatus === "COMPLETED" &&
              order.invoiceStatus === "PENDING" && <InvoiceForm id={id} />}{" "}
            {!historicalOnly && u.role.code.startsWith("FINANCE") &&
              order.invoiceStatus === "COMPLETED" &&
              order.paymentStatus !== "COMPLETED" && (
                <PaymentForm id={id} remaining={remaining} />
              )}
          </div>
        </Card>
        <Card className="xl:col-span-2">
          <h2 className="font-medium">流程记录</h2>
          <div className="mt-4 space-y-3">
            {[
              ...logs.map((x) => ({
                id: x.id,
                time: x.createdAt,
                user: x.user?.name || "系统",
                text: x.description,
              })),
              ...order.approvals.map((x) => ({
                id: x.id,
                time: x.createdAt,
                user: x.approver.name,
                text: `${x.stage}：${x.result}${x.comment ? `（${x.comment}）` : ""}`,
              })),
            ]
              .sort((a, b) => a.time.getTime() - b.time.getTime())
              .map((x) => (
                <div
                  key={x.id}
                  className="flex gap-4 border-l-2 border-zinc-200 pl-4 text-sm"
                >
                  <span className="shrink-0 text-zinc-400">
                    {dateTime(x.time)}
                  </span>
                  <span>
                    <b>{x.user}</b> · {x.text}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </>
  );
}
