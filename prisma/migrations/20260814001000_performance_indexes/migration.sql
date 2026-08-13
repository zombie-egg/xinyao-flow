-- Index the columns used by global navigation badges and the most frequently
-- opened customer/order lists. These are deliberately normal indexes so the
-- migration remains safe for existing imported data.
CREATE INDEX IF NOT EXISTS "AttendanceException_status_disposition_idx"
  ON "AttendanceException"("status", "disposition");

CREATE INDEX IF NOT EXISTS "Customer_updatedAt_idx"
  ON "Customer"("updatedAt");
CREATE INDEX IF NOT EXISTS "Customer_businessLine_createdAt_idx"
  ON "Customer"("businessLine", "createdAt");
CREATE INDEX IF NOT EXISTS "Customer_status_createdAt_idx"
  ON "Customer"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "Order_salesUserId_createdAt_idx"
  ON "Order"("salesUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_customerId_createdAt_idx"
  ON "Order"("customerId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_approvalStatus_createdAt_idx"
  ON "Order"("approvalStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_invoiceApplicationStatus_invoiceStatus_idx"
  ON "Order"("invoiceApplicationStatus", "invoiceStatus");
CREATE INDEX IF NOT EXISTS "Order_paymentStatus_createdAt_idx"
  ON "Order"("paymentStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_technicalUserId_technicalStatus_idx"
  ON "Order"("technicalUserId", "technicalStatus");
