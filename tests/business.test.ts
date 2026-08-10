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
import { businessOrderStatus } from "../lib/order-workflow";
import {chinaDateNumber,documentNumber} from '../lib/document-number';
import {normalizeCustomerContact} from '../lib/customer';
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
