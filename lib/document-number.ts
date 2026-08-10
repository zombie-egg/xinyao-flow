export function chinaDateNumber(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replaceAll("-", "");
}

export function documentNumber(
  employeeNumber: string,
  date: string,
  sequence: number,
) {
  return `${date}${String(sequence).padStart(2, "0")}${employeeNumber}`;
}
