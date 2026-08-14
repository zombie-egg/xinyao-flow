import { describe, it, expect } from "vitest";
import { haversineMeters, startOfChinaDay } from "../lib/utils";
import { cleanPublicValue } from "../lib/public-config";
import { safeUploadPath } from "../lib/uploads";
import { currentWorkInfo, fullWorkYears } from "../lib/work-years";
import {
  attendanceResult,
  chinaAttendanceDays,
  publishedAttendanceDeadline,
  timeOnChinaDay,
} from "../lib/attendance";
import { businessOrderStatus, isOrderCompleted } from "../lib/order-workflow";
import {chinaDateNumber,documentNumber} from '../lib/document-number';
import {normalizeCustomerContact} from '../lib/customer';
import { orderFormSchema } from "../lib/order-input";
import { canEditCustomerProfile, canOperateCustomerSalesFlow, customerAccessWhere, customerBusinessAccess } from "../lib/customer-access";
import { customerSchema } from "../lib/customer-input";
import { statisticsDateRange, statisticsOrderWhere } from "../lib/statistics";
describe("考勤距离", () => {
  it("同一坐标距离为 0", () =>
    expect(
      haversineMeters(
        { latitude: 31.2, longitude: 121.4 },
        { latitude: 31.2, longitude: 121.4 },
      ),
    ).toBe(0));
  it("约 111 米纬度差", () =>
    expect(
      haversineMeters(
        { latitude: 0, longitude: 0 },
        { latitude: 0.001, longitude: 0 },
      ),
    ).toBeGreaterThan(110));
});
describe("日期", () => {
  it("返回上海自然日起点", () =>
    expect(
      startOfChinaDay(new Date("2026-08-08T10:00:00Z")).toISOString(),
    ).toBe("2026-08-07T16:00:00.000Z"));
});
describe("工龄和年假", () => {
  it("按上海当天与入职周年计算完整工龄", () => {
    const start = new Date("2021-08-10T00:00:00.000Z");
    expect(fullWorkYears(start, new Date("2026-08-09T04:00:00.000Z"))).toBe(4);
    expect(fullWorkYears(start, new Date("2026-08-10T04:00:00.000Z"))).toBe(5);
  });
  it("年假天数与完整工龄一致", () =>
    expect(
      currentWorkInfo(
        new Date("2021-08-10T00:00:00.000Z"),
        new Date("2026-08-10T04:00:00.000Z"),
      ),
    ).toEqual({ workYears: 5, annualLeaveDays: 5 }));
});
describe("考勤规则", () => {
  it("考勤有效时间从管理员发布时间开始计算", () =>
    expect(
      publishedAttendanceDeadline(
        new Date("2026-08-09T01:15:00.000Z"),
        20,
      ).toISOString(),
    ).toBe("2026-08-09T01:35:00.000Z"));
  it("迟到且早退按旷工处理", () =>
    expect(attendanceResult(true, true)).toEqual({
      status: "ABSENT",
      exceptionType: "ABSENT",
    }));
  it("只早退保留出勤状态并创建早退异常", () =>
    expect(attendanceResult(false, true)).toEqual({
      status: "ON_TIME",
      exceptionType: "EARLY_LEAVE",
    }));
  it("按上海自然日生成上下班时间", () =>
    expect(
      timeOnChinaDay(
        new Date("2026-08-08T16:00:00.000Z"),
        "09:00",
      ).toISOString(),
    ).toBe("2026-08-09T01:00:00.000Z"));
  it("请假日期转换成上海考勤日期", () =>
    expect(
      chinaAttendanceDays(new Date("2026-08-09"), new Date("2026-08-10")).map(
        (x) => x.toISOString(),
      ),
    ).toEqual(["2026-08-08T16:00:00.000Z", "2026-08-09T16:00:00.000Z"]));
});
describe("部署配置", () => {
  it("清除环境变量外层引号", () =>
    expect(cleanPublicValue('"amap-key"')).toBe("amap-key"));
  it("拒绝上传目录穿越", () =>
    expect(safeUploadPath(["..", "secret"])).toBeNull());
});
describe("订单业务状态", () => {
  it("历史订单回款完成时也视为已完成", () => {
    expect(
      isOrderCompleted({ status: "IN_PROGRESS", paymentStatus: "COMPLETED" }),
    ).toBe(true);
  });
  it("审核、发票、回款阶段按业务顺序显示", () => {
    expect(
      businessOrderStatus({
        approvalStatus: "PENDING_ADMIN",
        invoiceStatus: "NOT_REQUIRED",
        paymentStatus: "NOT_REQUIRED",
        status: "PENDING_ADMIN",
      }),
    ).toBe("合同待审批");
    expect(
      businessOrderStatus({
        approvalStatus: "APPROVED",
        invoiceStatus: "PENDING",
        paymentStatus: "NOT_REQUIRED",
        status: "APPROVED",
      }),
    ).toBe("待开发票");
    expect(
      businessOrderStatus({
        approvalStatus: "APPROVED",
        invoiceStatus: "COMPLETED",
        paymentStatus: "PARTIAL",
        status: "IN_PROGRESS",
      }),
    ).toBe("待收回款");
    expect(
      businessOrderStatus({
        approvalStatus: "APPROVED",
        invoiceStatus: "COMPLETED",
        paymentStatus: "COMPLETED",
        status: "COMPLETED",
      }),
    ).toBe("已完成");
  });
});
describe('编号与客户去重',()=>{it('按日期、流水和销售工号生成合同与订单编号',()=>{expect(documentNumber('XYXS01','20260810',1)).toBe('2026081001XYXS01');expect(chinaDateNumber(new Date('2026-08-10T03:00:00Z'))).toBe('20260810')});it('联系人忽略空格和大小写',()=>expect(normalizeCustomerContact(' Jeffrey ')).toBe('jeffrey'))});
describe("订单表单", () => {
  it("销售经理提交完整订单和应收款时可通过校验", () => {
    const result = orderFormSchema.safeParse({
      customerId: "customer",
      name: "年度检测",
      businessType: "ENVIRONMENTAL_MONITORING",
      productTotal: "2000",
      amount: "1900",
      technicalSupportFee: "0",
      outsourcingFee: "0",
      reviewFee: "",
      otherExpense: "",
      expenseDetails: "",
      originalExpenseNote: "",
      adjustedNetAmount: "",
      signingStatus: "SIGNED",
      contractDate: "2026-08-11",
      signerId: "signer",
      responsibleUserId: "responsible",
      collaboratorId: "collaborator",
      projectRequirements: "完成环境检测服务",
      remark: "",
      receivableAmount: "1900",
      receivableExpectedDate: "2026-09-01",
      receivablePaymentType: "对公转账",
      receivableRemark: "",
      receivableResponsibleUserId: "finance-owner",
      receivableCollaboratorUserId: "",
    });
    expect(result.success).toBe(true);
  });
  it("产品合计和项目需求可以留空", () => {
    const result = orderFormSchema.safeParse({
      customerId: "customer",
      name: "日常检测",
      businessType: "ENVIRONMENTAL_MONITORING",
      productTotal: "",
      amount: "1900",
      technicalSupportFee: "0",
      outsourcingFee: "0",
      reviewFee: "",
      otherExpense: "",
      expenseDetails: "",
      originalExpenseNote: "",
      adjustedNetAmount: "",
      signingStatus: "SIGNED",
      contractDate: "2026-08-11",
      signerId: "signer",
      responsibleUserId: "responsible",
      collaboratorId: "collaborator",
      projectRequirements: "",
      remark: "",
      receivableAmount: "1900",
      receivableExpectedDate: "2026-09-01",
      receivablePaymentType: "",
      receivableRemark: "",
      receivableResponsibleUserId: "finance-owner",
      receivableCollaboratorUserId: "",
    });
    expect(result.success).toBe(true);
  });
});
describe("客户权限与表单", () => {
  it("普通销售只能查询自己负责或协同的客户", () => {
    expect(customerAccessWhere({ id: "sales-1", role: { code: "SALES_EMPLOYEE" } })).toEqual({
      OR: [
        { isPublicPool: true },
        { ownerId: "sales-1" },
        { collaborators: { some: { userId: "sales-1" } } },
      ],
    });
  });
  it("协同销售拥有客户业务操作权限", () => {
    expect(customerBusinessAccess({ ownerId: "owner", collaborators: [{ userId: "collab" }] }, "collab")).toBe(true);
  });
  it("管理员和销售经理可以编辑跟进客户，但不能代替负责人执行销售流程", () => {
    const customer = { ownerId: "owner", collaborators: [{ userId: "collab" }] };
    expect(canEditCustomerProfile("ADMIN", customer, "admin")).toBe(true);
    expect(canEditCustomerProfile("SALES_MANAGER", customer, "manager")).toBe(true);
    expect(canOperateCustomerSalesFlow("ADMIN", customer, "admin")).toBe(false);
    expect(canOperateCustomerSalesFlow("SALES_MANAGER", customer, "manager")).toBe(false);
    expect(canOperateCustomerSalesFlow("SALES_EMPLOYEE", customer, "collab")).toBe(true);
  });
  it("公海客户只能查看，认领前不能进行客户业务操作", () => {
    expect(customerBusinessAccess({ ownerId: null, isPublicPool: true, collaborators: [] }, "sales-1")).toBe(false);
  });
  it("新客户扩展字段能通过校验", () => {
    expect(customerSchema.safeParse({
      name: "星尧环保",
      contact: "张三",
      phone: "13800000000",
      contactMethods: [{ label: "微信", value: "xinyao-wechat" }],
      businessLine: "ENVIRONMENTAL_MONITORING",
      monitoringType: "验收检测",
      industry: "环保公司",
      status: "INITIAL_CONTACT",
      collaboratorIds: ["sales-2"],
    }).success).toBe(true);
  });
  it("客户可以选择职业卫生业务线", () => {
    expect(customerSchema.safeParse({
      name: "星尧职业卫生",
      contact: "李四",
      phone: "13900000000",
      contactMethods: [],
      businessLine: "OCCUPATIONAL_HEALTH",
      industry: "职业卫生",
      status: "POTENTIAL",
      collaboratorIds: [],
    }).success).toBe(true);
  });
  it("订单业务类型不能选择职业卫生", () => {
    const base = {
      customerId: "customer",
      name: "职业卫生订单",
      businessType: "OCCUPATIONAL_HEALTH",
      productTotal: "1000",
      amount: "1000",
      technicalSupportFee: "0",
      outsourcingFee: "0",
      signingStatus: "SIGNED",
      contractDate: "2026-08-13",
      signerId: "signer",
      responsibleUserId: "responsible",
      collaboratorId: "finance",
      projectRequirements: "职业卫生项目服务需求",
      receivableAmount: "1000",
      receivableExpectedDate: "2026-09-01",
      receivableResponsibleUserId: "finance",
    };
    expect(orderFormSchema.safeParse(base).success).toBe(false);
  });
});
describe("业务统计", () => {
  it("默认统计全部已审核且未取消订单，不再只查本月 approvedAt", () => {
    expect(statisticsOrderWhere({})).toEqual({
      approvalStatus: "APPROVED",
      status: { not: "CANCELLED" },
    });
  });
  it("日期筛选使用合同签订日期并覆盖上海自然日", () => {
    const range = statisticsDateRange("2026-08-01", "2026-08-31");
    expect(range.start?.toISOString()).toBe("2026-07-31T16:00:00.000Z");
    expect(range.end?.toISOString()).toBe("2026-08-31T15:59:59.999Z");
    expect(statisticsOrderWhere(range)).toEqual({
      approvalStatus: "APPROVED",
      status: { not: "CANCELLED" },
      contract: { contractDate: { gte: range.start, lte: range.end } },
    });
  });
});
