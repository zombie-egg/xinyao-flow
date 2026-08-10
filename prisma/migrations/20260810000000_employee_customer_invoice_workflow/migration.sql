ALTER TABLE "User" ADD COLUMN "employeeNumber" TEXT;

WITH ranked AS (
  SELECT u.id,
    CASE d.code::text
      WHEN 'FINANCE' THEN 'XYCW'
      WHEN 'SALES' THEN 'XYXS'
      WHEN 'TECH' THEN 'XYJS'
    END || LPAD(ROW_NUMBER() OVER (PARTITION BY d.code ORDER BY u."createdAt", u.id)::text, 2, '0') AS number
  FROM "User" u
  JOIN "Department" d ON d.id = u."departmentId"
)
UPDATE "User" u SET "employeeNumber" = ranked.number
FROM ranked WHERE ranked.id = u.id;

CREATE UNIQUE INDEX "User_employeeNumber_key" ON "User"("employeeNumber");

ALTER TABLE "Customer" ADD COLUMN "contactNormalized" TEXT NOT NULL DEFAULT '';
UPDATE "Customer" SET "contactNormalized" = LOWER(TRIM(contact));
CREATE INDEX "Customer_contactNormalized_idx" ON "Customer"("contactNormalized");

ALTER TABLE "Order"
ADD COLUMN "invoiceApplicationStatus" "ProcessStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN "invoiceApplicationFileUrl" TEXT,
ADD COLUMN "invoiceApplicationFileName" TEXT,
ADD COLUMN "invoiceApplicationFileSize" INTEGER,
ADD COLUMN "invoiceApplicationFileType" TEXT,
ADD COLUMN "invoiceApplicationNote" TEXT,
ADD COLUMN "invoiceAppliedAt" TIMESTAMP(3);

UPDATE "Order"
SET "invoiceApplicationStatus" = 'COMPLETED'
WHERE "approvalStatus" = 'APPROVED';
