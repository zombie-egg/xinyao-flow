import { z } from "zod";

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

export const customerSchema = z.object({
  category: z.enum(["XINYAO_ENVIRONMENT", "OCCUPATIONAL_HEALTH"]).default("XINYAO_ENVIRONMENT"),
  name: z.string().trim().min(2, "客户名称至少填写 2 个字").max(100),
  contact: z.string().trim().min(2, "联系人至少填写 2 个字").max(50),
  phone: z.string().trim().min(5, "联系电话至少填写 5 位").max(100),
  contactMethods: z
    .array(
      z.object({
        label: optionalText(30),
        value: z.string().trim().min(1).max(200),
      }),
    )
    .max(20)
    .default([]),
  address: optionalText(300),
  contactInfo: optionalText(300),
  remark: optionalText(1000),
  businessLine: z.enum(["ENVIRONMENTAL_MONITORING", "PUBLIC_HEALTH", "OCCUPATIONAL_HEALTH"]),
  monitoringType: z.string().trim().min(1, "请选择环境检测类型").max(100).optional(),
  industry: z.string().trim().min(1, "请填写客户行业").max(100),
  status: z.enum(["POTENTIAL", "INITIAL_CONTACT", "FOLLOWING", "WON", "LOYAL"]),
  nature: optionalText(100),
  customerScope: z.enum(["TRACKED", "PUBLIC"]).default("TRACKED"),
  salesUserId: optionalText(100),
  collaboratorIds: z.array(z.string().min(1)).max(20).default([]),
}).superRefine((value, ctx) => {
  if (value.businessLine === "ENVIRONMENTAL_MONITORING" && !value.monitoringType)
    ctx.addIssue({ code: "custom", path: ["monitoringType"], message: "请选择环境检测类型" });
});

export type CustomerInput = z.infer<typeof customerSchema>;
