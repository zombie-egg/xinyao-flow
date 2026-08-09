CREATE TABLE "DailyAttendanceRequirement" (
  "id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "requireCheckIn" BOOLEAN NOT NULL DEFAULT false,
  "requireCheckOut" BOOLEAN NOT NULL DEFAULT false,
  "checkInPublishedAt" TIMESTAMP(3),
  "checkOutPublishedAt" TIMESTAMP(3),
  "publishedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyAttendanceRequirement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyAttendanceRequirement_date_key" ON "DailyAttendanceRequirement"("date");

ALTER TABLE "DailyAttendanceRequirement"
ADD CONSTRAINT "DailyAttendanceRequirement_publishedById_fkey"
FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
