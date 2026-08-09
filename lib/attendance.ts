import type { AttendanceStatus, ExceptionType, RoleCode } from "@prisma/client";

export function timeOnChinaDay(day: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(day.getTime() + (hours * 60 + minutes) * 60000);
}
export function attendanceWindows(
  day: Date,
  workStart: string,
  workEnd: string,
) {
  const checkInEnd = timeOnChinaDay(day, workStart),
    checkOutStart = timeOnChinaDay(day, workEnd);
  return {
    checkInStart: new Date(checkInEnd.getTime() - 60 * 60 * 1000),
    checkInEnd,
    checkOutStart,
    checkOutEnd: new Date(checkOutStart.getTime() + 60 * 60 * 1000),
  };
}
export function attendanceResult(
  isLate: boolean,
  isEarlyLeave: boolean,
): { status: AttendanceStatus; exceptionType: ExceptionType | null } {
  if (isLate && isEarlyLeave)
    return { status: "ABSENT", exceptionType: "ABSENT" };
  if (isLate) return { status: "LATE", exceptionType: "LATE" };
  if (isEarlyLeave) return { status: "ON_TIME", exceptionType: "EARLY_LEAVE" };
  return { status: "ON_TIME", exceptionType: null };
}
export function attendanceDirectAdmin(
  role: RoleCode,
  departmentCode?: string | null,
) {
  return (
    role === "SALES_MANAGER" ||
    role === "TECH_MANAGER" ||
    departmentCode === "FINANCE"
  );
}
export function chinaAttendanceDays(start: Date, end: Date) {
  const days: Date[] = [];
  for (
    let cursor = Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      start.getUTCDate(),
    );
    cursor <=
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    cursor += 86400000
  )
    days.push(new Date(cursor - 8 * 3600000));
  return days;
}
