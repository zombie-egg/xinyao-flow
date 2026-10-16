const RETRYABLE_STATUSES = new Set([502, 503, 504]);
const MAX_ATTEMPTS = 2;
const REQUEST_TIMEOUT_MS = 120_000;
const RETRY_DELAY_MS = 800;

type OrderResponse<TData> = {
  success?: boolean;
  message?: string;
  code?: string;
  data?: TData;
};

type SubmitOptions = {
  fetcher?: typeof fetch;
  onRetry?: () => void;
  retryDelayMs?: number;
  timeoutMs?: number;
};

export class OrderSubmissionError extends Error {
  constructor(
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "OrderSubmissionError";
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function submitOrderRequest<TData = unknown>(
  url: string,
  method: "POST" | "PATCH",
  form: FormData,
  options: SubmitOptions = {},
) {
  const fetcher = options.fetcher || fetch;
  const retryDelayMs = options.retryDelayMs ?? RETRY_DELAY_MS;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const maxAttempts = method === "POST" ? MAX_ATTEMPTS : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetcher(url, {
        method,
        body: form,
        ...(typeof AbortSignal.timeout === "function"
          ? { signal: AbortSignal.timeout(timeoutMs) }
          : {}),
      });

      if (RETRYABLE_STATUSES.has(response.status) && attempt < maxAttempts - 1) {
        options.onRetry?.();
        await delay(retryDelayMs);
        continue;
      }

      const isJson = response.headers
        .get("content-type")
        ?.toLowerCase()
        .includes("application/json");
      if (!isJson) {
        const requestId = response.headers.get("x-zeabur-request-id") || undefined;
        if (attempt < maxAttempts - 1 && (response.status === 200 || response.status >= 500)) {
          options.onRetry?.();
          await delay(retryDelayMs);
          continue;
        }
        throw new OrderSubmissionError(
          `服务器返回异常响应（HTTP ${response.status}），请稍后重试。`,
          requestId,
        );
      }

      return { response, body: (await response.json()) as OrderResponse<TData> };
    } catch (error) {
      if (error instanceof OrderSubmissionError) throw error;
      if (attempt === maxAttempts - 1) {
        throw new OrderSubmissionError(
          method === "POST"
            ? "订单服务连接中断，系统已自动重试 1 次。请先刷新订单列表并按合同编号确认是否已保存，再重新提交。"
            : "订单服务连接中断。请先刷新订单或草稿，确认修改是否已保存后再重试。",
        );
      }
      options.onRetry?.();
      await delay(retryDelayMs);
    }
  }

  throw new OrderSubmissionError("订单服务暂时无法响应，请稍后重试。");
}
