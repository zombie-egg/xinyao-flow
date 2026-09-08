import { describe, expect, it } from "vitest";
import { customerWhere } from "../lib/customer-query";
import { exportHref } from "../lib/export-query";
import { orderWhere } from "../lib/order-query";

const admin = { id: "admin", departmentId: null, role: { code: "ADMIN" as const } };

describe("筛选后的 CSV 导出", () => {
  it("按 2026 年 8 月筛选订单时复用页面的完整月份范围", () => {
    const params = {
      createdFromMode: "month",
      createdFromValue: "2026-08",
      createdToMode: "month",
      createdToValue: "2026-08",
    };
    const where = orderWhere(admin, params);
    const serialized = JSON.stringify(where);
    expect(serialized).toContain("2026-07-31T16:00:00.000Z");
    expect(serialized).toContain("2026-08-31T16:00:00.000Z");
    expect(exportHref("orders", params)).toContain("createdFromValue=2026-08");
  });

  it("客户多条件筛选同时用于页面和导出", () => {
    const params = {
      customerName: "星尧",
      ownerId: "sales-1",
      collaboratorId: "sales-2",
      customerStatus: "FOLLOWING",
      nature: "民营企业",
      businessLine: "ENVIRONMENTAL_MONITORING",
      category: "XINYAO_ENVIRONMENT",
    };
    const where = customerWhere(admin, params);
    const serialized = JSON.stringify(where);
    for (const expected of ["星尧", "sales-1", "sales-2", "FOLLOWING", "民营企业", "ENVIRONMENTAL_MONITORING", "XINYAO_ENVIRONMENT"])
      expect(serialized).toContain(expected);
    const href = exportHref("customers", params);
    for (const [key, value] of Object.entries(params))
      expect(new URL(href, "https://example.test").searchParams.get(key)).toBe(value);
  });

  it("无筛选条件时导出全部有权限查看的数据", () => {
    expect(exportHref("orders", {})).toBe("/api/orders/export");
    expect(exportHref("customers", {})).toBe("/api/customers/export");
    expect(orderWhere(admin, {})).toEqual(orderWhere(admin, { page: "1" }));
    expect(customerWhere(admin, {})).toEqual(customerWhere(admin, { page: "1" }));
  });

  it("分页参数不进入导出 URL，导出查询也不限制当前页", () => {
    const params = { page: "3", customerStatus: "WON" };
    const href = exportHref("customers", params);
    expect(href).toBe("/api/customers/export?customerStatus=WON");
    expect(customerWhere(admin, params)).toEqual(customerWhere(admin, { customerStatus: "WON" }));
  });

  it("页面计数和导出使用同一个筛选条件构造结果", () => {
    const params = { status: "PROCESSING", salesUserId: "sales-1", category: "OCCUPATIONAL_HEALTH", amountMin: "100", netAmountMax: "800" };
    const pageWhere = orderWhere(admin, params);
    const exportWhere = orderWhere(admin, Object.fromEntries(new URL(exportHref("orders", params), "https://example.test").searchParams));
    expect(exportWhere).toEqual(pageWhere);
  });
});
