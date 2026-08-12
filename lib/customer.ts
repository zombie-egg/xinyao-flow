export function normalizeCustomerName(value: string) {
  return value.trim().toLocaleLowerCase("zh-CN");
}
export function normalizeCustomerPhone(value: string) {
  return value.trim().replace(/[\s()-]/g, "");
}
export function normalizeCustomerContact(value: string) {
  return value.trim().replace(/\s+/g, "").toLocaleLowerCase("zh-CN");
}
export function normalizeCustomerField(value: string) {
  return value
    .trim()
    .replace(/[\s()\-]/g, "")
    .toLocaleLowerCase("zh-CN");
}
