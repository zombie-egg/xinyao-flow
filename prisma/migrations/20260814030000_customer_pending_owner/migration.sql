ALTER TABLE "Customer"
ADD COLUMN "pendingOwnerName" TEXT;

CREATE INDEX "Customer_pendingOwnerName_idx"
ON "Customer"("pendingOwnerName");
