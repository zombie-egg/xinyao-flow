ALTER TABLE "Contract"
ADD COLUMN "historicalSalesName" TEXT;

ALTER TABLE "Order"
ADD COLUMN "historicalSalesName" TEXT;

CREATE INDEX "Order_historicalSalesName_createdAt_idx"
ON "Order"("historicalSalesName", "createdAt");
