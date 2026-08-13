import { requireUser } from "@/lib/auth";
import { apiError, fail, ok } from "@/lib/api";
import { deepSeekMapping } from "@/lib/deepseek";
import { heuristicMapping, importFields, normalizeBusiness, parseImportFile, rowValue, splitNames, type ImportEntity } from "@/lib/import-tools";
import { db } from "@/lib/db";

export const runtime = "nodejs";

function canImport(role: string, entity: ImportEntity) {
  return role === "ADMIN" || role === "SALES_MANAGER" || (entity === "customers" && role === "SALES_EMPLOYEE");
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const form = await req.formData();
    const entity = String(form.get("entity")) as ImportEntity;
    if (!(["customers", "orders"] as string[]).includes(entity)) return fail("导入类型无效", "INVALID_ENTITY");
    if (!canImport(user.role.code, entity)) throw new Error("FORBIDDEN");
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return fail("请选择导入文件", "FILE_REQUIRED");
    const parsed = await parseImportFile(file);
    if (parsed.rows.length > 10000) return fail("单次导入最多支持 10000 条记录", "TOO_MANY_ROWS");
    const heuristic = heuristicMapping(entity, parsed.headers);
    let mapping = heuristic;
    let ai: { used: boolean; notes: string[]; agreed: boolean; error?: string } = { used: false, notes: [], agreed: true };
    if (String(form.get("useAi")) === "true") {
      try {
        const result = await deepSeekMapping(entity, parsed.headers, parsed.rows.slice(0, 8));
        const aiMapping = Object.fromEntries(importFields[entity].map(([field]) => [field, parsed.headers.includes(result.mapping?.[field]) ? result.mapping[field] : null]));
        const disagreements = Object.keys(heuristic).filter((field) => heuristic[field] && aiMapping[field] && heuristic[field] !== aiMapping[field]);
        mapping = Object.fromEntries(Object.keys(heuristic).map((field) => [field, disagreements.includes(field) ? null : aiMapping[field] || heuristic[field]]));
        ai = { used: true, notes: [...(result.notes || []), ...disagreements.map((field) => `${field}：系统与 AI 映射不一致，需人工选择`) ], agreed: disagreements.length === 0 };
      } catch (error) {
        ai = { used: true, notes: ["AI 服务暂时不可用，已使用系统规则生成预览"], agreed: false, error: error instanceof Error ? error.message : "AI_ERROR" };
      }
    }
    const sales = await db.user.findMany({ where: { status: "ACTIVE", role: { code: { in: ["SALES_MANAGER", "SALES_EMPLOYEE"] } } }, select: { id: true, name: true, username: true, email: true, employeeNumber: true } });
    const matchName = (name: string) => sales.find((person) => [person.name, person.username, person.email, person.employeeNumber].filter(Boolean).some((value) => String(value).trim().toLowerCase() === name.trim().toLowerCase()));
    const preview = parsed.rows.slice(0, 100).map((row, index) => {
      const ownerText = rowValue(row, mapping, entity === "customers" ? "owner" : "responsible");
      const ownerNames = splitNames(ownerText);
      const owner = ownerNames.map(matchName).find(Boolean) || null;
      const collaboratorText = rowValue(row, mapping, entity === "customers" ? "collaborators" : "financeCollaborator");
      const collaboratorNames = splitNames(collaboratorText);
      const matchedCollaborators = collaboratorNames.map(matchName).filter(Boolean);
      const required = entity === "customers"
        ? [rowValue(row, mapping, "name"), rowValue(row, mapping, "contact"), rowValue(row, mapping, "phone"), rowValue(row, mapping, "industry"), normalizeBusiness(rowValue(row, mapping, "businessLine"))]
        : [rowValue(row, mapping, "customerName"), rowValue(row, mapping, "amount"), normalizeBusiness(rowValue(row, mapping, "businessType"))];
      const missingPeople = [...ownerNames.filter((name) => !matchName(name)), ...collaboratorNames.filter((name) => !matchName(name))];
      const issues = [...(required.some((value) => !value) ? ["必填字段缺失"] : []), ...(ownerNames.length && !owner ? ["负责人未注册"] : []), ...(missingPeople.length ? [`人员未匹配：${[...new Set(missingPeople)].join("、")}`] : [])];
      return { row: index + 1, source: row, owner, collaborators: matchedCollaborators, issues, ready: issues.length === 0 };
    });
    const allPeople = [...new Set(parsed.rows.flatMap((row) => [rowValue(row, mapping, entity === "customers" ? "owner" : "responsible"), rowValue(row, mapping, entity === "customers" ? "collaborators" : "financeCollaborator")].flatMap(splitNames)))];
    return ok({ token: null, filename: file.name, sheetName: parsed.sheetName, totalRows: parsed.rows.length, headers: parsed.headers, targetFields: importFields[entity], mapping, ai, salesUsers: sales, unmatchedPeople: allPeople.filter((name) => !matchName(name)), preview, importEnabled: false, message: "当前仅生成审核预览；确认人员全部注册后再执行正式导入。" });
  } catch (error) {
    if (error instanceof Error && error.message === "UNSUPPORTED_IMPORT_FILE") return fail("仅支持 XLSX、XLS、CSV、JSON 文件", "UNSUPPORTED_IMPORT_FILE");
    if (error instanceof Error && error.message === "IMPORT_FILE_TOO_LARGE") return fail("导入文件不能超过 20MB", "IMPORT_FILE_TOO_LARGE");
    return apiError(error);
  }
}
