CREATE TABLE "Receivable" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "expectedDate" TIMESTAMP(3) NOT NULL,
  "paymentType" TEXT,
  "remark" TEXT,
  "responsibleUserId" TEXT NOT NULL,
  "collaboratorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Receivable_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Receivable_orderId_key" ON "Receivable"("orderId");
CREATE UNIQUE INDEX "Receivable_number_key" ON "Receivable"("number");
CREATE INDEX "Receivable_expectedDate_idx" ON "Receivable"("expectedDate");
CREATE INDEX "Receivable_responsibleUserId_idx" ON "Receivable"("responsibleUserId");

ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_collaboratorUserId_fkey" FOREIGN KEY ("collaboratorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
