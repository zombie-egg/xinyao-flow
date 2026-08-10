-- The invoice-application feature was added after these orders were approved.
-- Reopen only untouched legacy records; orders already invoiced stay completed.
UPDATE "Order"
SET "invoiceApplicationStatus" = 'PENDING'
WHERE "approvalStatus" = 'APPROVED'
  AND "invoiceApplicationStatus" = 'COMPLETED'
  AND "invoiceStatus" <> 'COMPLETED'
  AND "invoiceApplicationFileUrl" IS NULL
  AND "invoiceApplicationNote" IS NULL
  AND "invoiceAppliedAt" IS NULL;
