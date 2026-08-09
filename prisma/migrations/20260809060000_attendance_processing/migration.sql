CREATE TYPE "AttendanceDisposition" AS ENUM ('PENDING', 'ARCHIVED', 'EXEMPT');

ALTER TABLE "Attendance"
ADD COLUMN "excludedFromStats" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AttendanceException"
ADD COLUMN "disposition" "AttendanceDisposition" NOT NULL DEFAULT 'PENDING';

UPDATE "AttendanceException" SET "disposition" = 'ARCHIVED';
