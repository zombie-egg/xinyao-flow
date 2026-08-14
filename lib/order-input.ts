import { z } from "zod";

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max, `内容不能超过 ${max} 个字`).optional(),
  );

const optionalNumber = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.coerce.number({ error: "请输入正确的金额" }).nonnegative("金额不能小于 0").optional(),
);

export const orderNameOptions = [
  "年度检测",
  "日常检测",
  "客户验厂",
  "验收检测",
  "土壤调查",
  "公共卫生",
  "职业卫生定期检测",
  "职业卫生现状评价",
  "职业卫生委托检测",
] as const;

export const orderFormSchema = z
  .object({
    customerId: z.string().min(1, "请选择客户"),
    contractNumber: z.string().trim().min(1, "请输入合同编号").max(100, "合同编号不能超过 100 个字"),
    name: z.enum(orderNameOptions, { error: "请选择订单名称" }),
    businessType: z.enum(["ENVIRONMENTAL_MONITORING", "PUBLIC_HEALTH"], {
      error: "请选择业务类型",
    }),
    productTotal: optionalNumber,
    amount: z.coerce.number({ error: "请输入合同金额" }).positive("合同金额必须大于 0"),
    technicalSupportFee: z.coerce.number({ error: "请输入技术支持费用" }).nonnegative("技术支持费用不能小于 0"),
    outsourcingFee: z.coerce.number({ error: "请输入外包费用" }).nonnegative("外包费用不能小于 0"),
    reviewFee: optionalNumber,
    otherExpense: optionalNumber,
    expenseDetails: optionalText(3000),
    originalExpenseNote: optionalText(3000),
    adjustedNetAmount: optionalNumber,
    signingStatus: z.enum(["SIGNED", "PENDING_SIGNATURE"], {
      error: "请选择合同状态",
    }),
    contractDate: z.coerce.date({ error: "请选择正确的签订日期" }),
    signerId: z.string().min(1, "请选择签订人"),
    responsibleUserId: z.string().min(1, "请选择订单负责人"),
    collaboratorId: z.string().min(1, "请选择订单协同人"),
    projectRequirements: optionalText(10000),
    remark: optionalText(2000),
    receivableAmount: z.coerce.number({ error: "请输入应收金额" }).positive("应收金额必须大于 0"),
    receivableExpectedDate: z.coerce.date({ error: "请选择预计回款日期" }),
    receivablePaymentType: optionalText(100),
    receivableRemark: optionalText(1000),
    receivableResponsibleUserId: z.string().min(1, "请选择应收款负责人"),
    receivableCollaboratorUserId: optionalText(100),
  })
  .superRefine((value, ctx) => {
    const expenses =
      value.technicalSupportFee +
      value.outsourcingFee +
      (value.reviewFee || 0) +
      (value.otherExpense || 0);
    if (expenses > value.amount)
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "各项费用合计不能超过合同金额",
      });
  });

export const contractFileTypes = new Map([
  ["application/pdf", "pdf"],
  ["application/msword", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export type OrderFormInput = z.infer<typeof orderFormSchema>;
