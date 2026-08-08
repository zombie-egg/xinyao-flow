export function normalizeCustomerName(value:string){return value.trim().toLocaleLowerCase('zh-CN')}
export function normalizeCustomerPhone(value:string){return value.trim().replace(/[\s()-]/g,'')}
