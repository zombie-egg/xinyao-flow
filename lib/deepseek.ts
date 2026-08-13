import type { ImportEntity } from "./import-tools";
import { importFields } from "./import-tools";

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  return JSON.parse(fenced || text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
}

export async function deepSeekMapping(entity: ImportEntity, headers: string[], sampleRows: Record<string, unknown>[]) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_NOT_CONFIGURED");
  const response = await fetch(process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "你是企业CRM数据导入审计员。只输出JSON。不能编造字段映射；不确定时填null。" },
        { role: "user", content: JSON.stringify({ task: `将来源表头映射到${entity === "customers" ? "客户" : "订单"}系统字段`, targetFields: importFields[entity], sourceHeaders: headers, sampleRows, output: { mapping: "对象，键为目标字段，值为来源表头或null", notes: "字符串数组" } }) },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`DEEPSEEK_HTTP_${response.status}`);
  const json = await response.json();
  return extractJson(json.choices?.[0]?.message?.content || "{}");
}
