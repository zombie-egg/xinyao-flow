ALTER TABLE "DailyAttendanceRequirement"
ADD COLUMN "checkInDurationMinutes" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN "checkOutDurationMinutes" INTEGER NOT NULL DEFAULT 20;

ALTER TABLE "CompanySetting"
ADD COLUMN "attendanceWindowMinutes" INTEGER NOT NULL DEFAULT 20;
