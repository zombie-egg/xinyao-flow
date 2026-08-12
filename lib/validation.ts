import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().trim().min(2),
  password: z.string().min(8),
});

export const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(5000),
});

export const leaveSchema = z
  .object({
    type: z.enum(["ANNUAL", "PERSONAL", "BUSINESS_TRIP"]),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().max(1000).optional(),
    destination: z.string().max(200).optional(),
    tripBudgetRequired: z.boolean().default(false),
    estimatedBudget: z.number().nonnegative().optional(),
    remark: z.string().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.endDate < value.startDate)
      ctx.addIssue({ code: "custom", message: "结束日期不能早于开始日期", path: ["endDate"] });
    const days = Math.floor((value.endDate.getTime() - value.startDate.getTime()) / 86400000) + 1;
    if (days > 365)
      ctx.addIssue({ code: "custom", message: "单次请假或出差不能超过365天", path: ["endDate"] });
    if (value.type === "PERSONAL" && !value.reason)
      ctx.addIssue({ code: "custom", message: "事假原因必填", path: ["reason"] });
    if (value.type === "BUSINESS_TRIP" && !value.destination)
      ctx.addIssue({ code: "custom", message: "出差地点必填", path: ["destination"] });
    if (value.tripBudgetRequired && value.estimatedBudget === undefined)
      ctx.addIssue({ code: "custom", message: "请填写预计经费", path: ["estimatedBudget"] });
  });

export const customerSchema = z.object({
  name: z.string().min(2).max(100),
  contact: z.string().min(2).max(50),
  phone: z.string().regex(/^1\d{10}$/, "手机号格式不正确"),
  address: z.string().max(300).optional(),
  remark: z.string().max(1000).optional(),
});

export const contractSchema = z.object({
  customerId: z.string().min(1),
  contractNumber: z.string().regex(/^[A-Za-z0-9_-]{4,40}$/),
  name: z.string().min(2).max(150),
  amount: z.number().positive(),
  dealPrice: z.number().positive(),
  contractDate: z.coerce.date(),
  remark: z.string().max(1000).optional(),
});
