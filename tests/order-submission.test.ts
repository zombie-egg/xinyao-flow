import { describe, expect, it, vi } from "vitest";
import { OrderSubmissionError, submitOrderRequest } from "../lib/order-submission";

describe("订单提交请求", () => {
  it("网络短暂失败时只重试一次并复用原表单", async () => {
    const form = new FormData();
    form.set("contractNumber", "TEST-001");
    const fetcher = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: "order-1" } }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }));
    const onRetry = vi.fn();

    const result = await submitOrderRequest<{ id: string }>(
      "/api/orders",
      "POST",
      form,
      { fetcher, onRetry, retryDelayMs: 0 },
    );

    expect(result.response.status).toBe(201);
    expect(result.body.data?.id).toBe("order-1");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][1]?.body).toBe(form);
    expect(fetcher.mock.calls[1][1]?.body).toBe(form);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("网关返回非 JSON 错误页时重试一次", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("Bad Gateway", {
        status: 502,
        headers: { "content-type": "text/html" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: "order-2" } }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }));

    const result = await submitOrderRequest<{ id: string }>(
      "/api/orders",
      "POST",
      new FormData(),
      { fetcher, retryDelayMs: 0 },
    );

    expect(result.body.data?.id).toBe("order-2");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("4xx 非 JSON 响应不重复发送表单并保留请求编号", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("Payload Too Large", {
      status: 413,
      headers: {
        "content-type": "text/html",
        "x-zeabur-request-id": "request-123",
      },
    }));

    await expect(submitOrderRequest(
      "/api/orders",
      "POST",
      new FormData(),
      { fetcher, retryDelayMs: 0 },
    )).rejects.toMatchObject({
      name: "OrderSubmissionError",
      requestId: "request-123",
    } satisfies Partial<OrderSubmissionError>);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("编辑订单的 PATCH 请求失败时不自动重发，避免重复副作用", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(submitOrderRequest(
      "/api/orders/order-1",
      "PATCH",
      new FormData(),
      { fetcher, retryDelayMs: 0 },
    )).rejects.toMatchObject({
      name: "OrderSubmissionError",
      message: expect.stringContaining("请先刷新订单或草稿"),
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
