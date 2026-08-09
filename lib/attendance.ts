import type { AttendanceStatus, ExceptionType, RoleCode } from "@prisma/client";

export function timeOnChinaDay(day: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(day.getTime() + (hours * 60 + minutes) * 60000);
}
export function publishedAttendanceDeadline(
  publishedAt: Date,
  durationMinutes: number,
) {
  return new Date(publishedAt.getTime() + durationMinutes * 60 * 1000);
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
