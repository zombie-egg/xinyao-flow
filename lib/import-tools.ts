import * as XLSX from "xlsx";

export type ImportEntity = "customers" | "orders";
export type RawRow = Record<string, unknown>;

export const importFields = {
  customers: [
    ["name", "客户名称"], ["contact", "联系人"], ["phone", "联系电话"],
    ["address", "地址"], ["contactInfo", "其他联系信息"], ["remark", "备注"],
    ["businessLine", "业务线"], ["monitoringType", "检测类型"], ["industry", "客户行业"],
    ["status", "客户状态"], ["nature", "客户性质"], ["owner", "负责销售"],
    ["collaborators", "协同销售"], ["createdAt", "创建时间"],
  ],
  orders: [
    ["contractNumber", "合同编号"], ["name", "订单名称"], ["customerName", "客户名称"],
    ["businessType", "业务类型"], ["projectRequirements", "项目需求"],
    ["productTotal", "产品合计"], ["amount", "合同金额"],
    ["technicalSupportFee", "技术支持费用"], ["outsourcingFee", "外包费用"],
    ["reviewFee", "评审费用"], ["otherExpense", "其他支出"], ["netOrderAmount", "净签单金额"],
    ["signingStatus", "合同状态"], ["signer", "签订人"], ["contractDate", "签订日期"],
    ["responsible", "负责人"], ["financeCollaborator", "财务协同人"], ["remark", "订单备注"],
    ["createdAt", "创建时间"], ["paidAmount", "已收金额"],
  ],
} as const;

const aliases: Record<string, string[]> = {
  name: ["客户名称", "订单名称", "名称"], contact: ["联系人", "姓名"], phone: ["联系电话", "电话", "手机"],
  address: ["地址", "客户地址", "详细地址"], contactInfo: ["其他联系信息", "邮箱", "微信"], remark: ["备注", "订单备注"],
  businessLine: ["业务线"], monitoringType: ["环境检测类型", "检测类型"], industry: ["客户行业", "行业"],
  status: ["客户状态"], nature: ["客户性质"], owner: ["负责人", "跟进人", "负责销售", "创建人"],
  collaborators: ["协同人", "协同跟进人", "协同销售"], createdAt: ["创建时间"],
  contractNumber: ["合同编号"], customerName: ["客户名称"], businessType: ["业务类型"],
  projectRequirements: ["检测项目", "项目需求"], productTotal: ["产品合计"], amount: ["合同金额"],
  technicalSupportFee: ["技术支持费用"], outsourcingFee: ["外包费用"], reviewFee: ["评审费用"],
  otherExpense: ["其他支出"], netOrderAmount: ["净签单金额"], signingStatus: ["合同状态"],
  signer: ["签订人"], contractDate: ["签订日期"], responsible: ["负责人"],
  financeCollaborator: ["协同人", "财务协同人"], paidAmount: ["已收金额"],
};

const exactPreferred: Record<string, string[]> = {
  name: ["客户名称", "订单名称"], contact: ["添加联系人/姓名", "联系人"],
  phone: ["添加联系人/联系电话/电话", "联系电话", "电话"],
  address: ["客户地址/详细地址", "详细地址", "地址"],
  owner: ["跟进人", "负责销售", "负责人", "创建人"],
  collaborators: ["协同跟进人", "协同销售", "协同人"],
  customerName: ["客户名称/名称", "客户名称"],
  remark: ["订单备注", "备注"],
};

function cleanHeader(value: unknown) {
  return String(value ?? "").replace(/[\s*^：:（）()]/g, "").trim();
}

function uniqueHeaders(headers: unknown[]) {
  const counts = new Map<string, number>();
  return headers.map((value, index) => {
    const base = cleanHeader(value) || `字段${index + 1}`;
    const count = (counts.get(base) || 0) + 1;
    counts.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  });
}

function bestHeaderRow(rows: unknown[][]) {
  let best = 0, score = -1;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const filled = rows[i].filter((value) => String(value ?? "").trim()).length;
    if (filled > score) { score = filled; best = i; }
  }
  return best;
}

function combineHeaders(rows: unknown[][], start: number, end: number) {
  const width = Math.max(...rows.slice(start, end).map((row) => row.length), 0);
  return uniqueHeaders(Array.from({ length: width }, (_, index) => {
    const path = rows.slice(start, end).map((row) => cleanHeader(row[index])).filter(Boolean);
    return [...new Set(path)].join("/");
  }));
}

export async function parseImportFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["xlsx", "xls", "csv", "json"].includes(extension)) throw new Error("UNSUPPORTED_IMPORT_FILE");
  if (file.size > 20 * 1024 * 1024) throw new Error("IMPORT_FILE_TOO_LARGE");
  if (extension === "json") {
    const parsed = JSON.parse(await file.text());
    const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.data) ? parsed.data : [parsed];
    if (!(rows as unknown[]).every((row: unknown) => row && typeof row === "object" && !Array.isArray(row))) throw new Error("INVALID_JSON_ROWS");
    return { sheetName: "JSON", headers: [...new Set<string>((rows as RawRow[]).flatMap((row) => Object.keys(row)))], rows: rows as RawRow[] };
  }
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames.find((name) => !/^hidden/i.test(name)) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("EMPTY_WORKBOOK");
  const actualCells = Object.keys(sheet).filter((key) => !key.startsWith("!"));
  if (actualCells.length) {
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
    for (const address of actualCells) { const cell = XLSX.utils.decode_cell(address); range.e.r = Math.max(range.e.r, cell.r); range.e.c = Math.max(range.e.c, cell.c); }
    sheet["!ref"] = XLSX.utils.encode_range(range);
  }
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false, blankrows: false }) as unknown[][];
  for (const merge of sheet["!merges"] || []) {
    const value = matrix[merge.s.r]?.[merge.s.c];
    for (let row = merge.s.r; row <= merge.e.r; row++) for (let col = merge.s.c; col <= merge.e.c; col++) {
      matrix[row] ||= [];
      if (matrix[row][col] == null) matrix[row][col] = value;
    }
  }
  const declaredHeaderRows = Number(String(matrix[0]?.[0] || "").match(/表头[:：](\d+)/)?.[1]);
  const headerRow = Number.isFinite(declaredHeaderRows) && declaredHeaderRows > 1 ? 1 : bestHeaderRow(matrix);
  const dataStart = Number.isFinite(declaredHeaderRows) && declaredHeaderRows > 1 ? declaredHeaderRows : headerRow + 1;
  const headers = combineHeaders(matrix, headerRow, dataStart);
  const rows: RawRow[] = matrix.slice(dataStart).map((values: unknown[]) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? null]))).filter((row: RawRow) => Object.values(row).some((value) => String(value ?? "").trim()));
  return { sheetName, headers, rows };
}

function normalize(value: string) { return cleanHeader(value).toLowerCase(); }

export function heuristicMapping(entity: ImportEntity, headers: string[]) {
  return Object.fromEntries(importFields[entity].map(([field]) => {
    const terms = aliases[field] || [];
    const header = headers.find((candidate) => (exactPreferred[field] || []).some((term) => normalize(candidate) === normalize(term)))
      || headers.find((candidate) => terms.some((term) => normalize(candidate).split("/").includes(normalize(term))))
      || headers.find((candidate) => terms.some((term) => normalize(candidate) === normalize(term)))
      || headers.find((candidate) => terms.some((term) => normalize(candidate).includes(normalize(term))));
    return [field, header || null];
  }));
}

export function rowValue(row: RawRow, mapping: Record<string, string | null>, field: string) {
  const header = mapping[field];
  const value = header ? row[header] : null;
  return value == null ? "" : String(value).trim();
}

export function splitNames(value: string) { return value.split(/[,，、;；/]/).map((item) => item.trim()).filter(Boolean); }

export function normalizeBusiness(value: string) {
  if (value.includes("公共卫生")) return "PUBLIC_HEALTH";
  if (value.includes("职业卫生")) return "OCCUPATIONAL_HEALTH";
  if (value.includes("环境")) return "ENVIRONMENTAL_MONITORING";
  return "";
}

export function normalizeCustomerStatus(value: string) {
  if (value.includes("忠诚")) return "LOYAL";
  if (value.includes("成交")) return "WON";
  if (value.includes("持续") || value.includes("跟进")) return "FOLLOWING";
  if (value.includes("初步") || value.includes("接触")) return "INITIAL_CONTACT";
  return "POTENTIAL";
}

export function normalizeSigningStatus(value: string) { return value.includes("执行") || value.includes("签约") || value.includes("完毕") ? "SIGNED" : "PENDING_SIGNATURE"; }
