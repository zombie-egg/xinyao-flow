ALTER TYPE "ExceptionType" ADD VALUE IF NOT EXISTS 'EARLY_LEAVE';

ALTER TABLE "Attendance"
ADD COLUMN "isLate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isEarlyLeave" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Attendance" SET "isLate" = true WHERE "status" = 'LATE';
