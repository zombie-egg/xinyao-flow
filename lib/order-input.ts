import { z } from "zod";
import { calculateNetAmountCents, isMoney, normalizeMoney } from "./money";

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max, `内容不能超过 ${max} 个字`).optional(),
  );

const optionalMoney = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.string({ error: "请输入正确的金额" })
    .trim()
    .refine(isMoney, "金额必须是最多两位小数的非负数")
    .transform(normalizeMoney)
    .optional(),
);

const requiredMoney = (missingMessage: string, positiveMessage?: string) =>
  z.preprocess(
    (value) => (typeof value === "number" ? String(value) : value),
    z.string({ error: missingMessage })
      .trim()
      .refine(isMoney, "金额必须是最多两位小数的非负数")
      .transform(normalizeMoney)
      .refine(
        (value) => !positiveMessage || value !== "0.00",
        positiveMessage || missingMessage,
      ),
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
    category: z.enum(["XINYAO_ENVIRONMENT", "OCCUPATIONAL_HEALTH"], {
      error: "请选择订单归属",
    }).default("XINYAO_ENVIRONMENT"),
    customerId: z.string().min(1, "请选择客户"),
    contractNumber: z.string().trim().min(1, "请输入合同编号").max(100, "合同编号不能超过 100 个字"),
    name: z.enum(orderNameOptions, { error: "请选择订单名称" }),
    businessType: z.enum(["ENVIRONMENTAL_MONITORING", "PUBLIC_HEALTH", "OCCUPATIONAL_HEALTH"], {
      error: "请选择业务类型",
    }),
    productTotal: optionalMoney,
    amount: requiredMoney("请输入合同金额", "合同金额必须大于 0"),
    technicalSupportFee: requiredMoney("请输入技术支持费用"),
    outsourcingFee: requiredMoney("请输入外包费用"),
    reviewFee: optionalMoney,
    otherExpense: optionalMoney,
    expenseDetails: optionalText(3000),
    originalExpenseNote: optionalText(3000),
    adjustedNetAmount: optionalMoney,
    signingStatus: z.enum(["SIGNED", "PENDING_SIGNATURE"], {
      error: "请选择合同状态",
    }),
    contractDate: z.coerce.date({ error: "请选择正确的签订日期" }),
    signerId: z.string().min(1, "请选择签订人"),
    responsibleUserId: z.string().min(1, "请选择订单负责人"),
    collaboratorId: z.string().min(1, "请选择订单协同人"),
    projectRequirements: optionalText(10000),
    remark: optionalText(2000),
    receivableAmount: requiredMoney("请输入应收金额", "应收金额必须大于 0"),
    receivableExpectedDate: z.coerce.date({ error: "请选择预计回款日期" }),
    receivablePaymentType: optionalText(100),
    receivableRemark: optionalText(1000),
    receivableResponsibleUserId: z.string().min(1, "请选择应收款负责人"),
    receivableCollaboratorUserId: optionalText(100),
  })
  .superRefine((value, ctx) => {
    const netAmount = calculateNetAmountCents({
      amount: value.amount,
      technicalSupportFee: value.technicalSupportFee,
      outsourcingFee: value.outsourcingFee,
      reviewFee: value.reviewFee || "0.00",
      otherExpense: value.otherExpense || "0.00",
    });
    if (netAmount !== null && netAmount < 0)
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
