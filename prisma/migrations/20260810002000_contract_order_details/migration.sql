CREATE TYPE "BusinessType" AS ENUM ('ENVIRONMENTAL_MONITORING', 'PUBLIC_HEALTH');
CREATE TYPE "ContractSigningStatus" AS ENUM ('SIGNED', 'PENDING_SIGNATURE');

ALTER TABLE "Contract"
ADD COLUMN "businessType" "BusinessType" NOT NULL DEFAULT 'ENVIRONMENTAL_MONITORING',
ADD COLUMN "signingStatus" "ContractSigningStatus" NOT NULL DEFAULT 'SIGNED',
ADD COLUMN "signerId" TEXT,
ADD COLUMN "responsibleUserId" TEXT,
ADD COLUMN "collaboratorId" TEXT,
ADD COLUMN "productTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "technicalSupportFee" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "outsourcingFee" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "reviewFee" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "otherExpense" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "netOrderAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "adjustedNetAmount" DECIMAL(14,2),
ADD COLUMN "expenseDetails" TEXT,
ADD COLUMN "originalExpenseNote" TEXT;

ALTER TABLE "Contract" ADD CONSTRAINT "Contract_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing contracts predate the split product/expense fields. Preserve their
-- current amount as both the product total and the initial net order amount.
UPDATE "Contract"
SET "productTotal" = "amount",
    "netOrderAmount" = "amount";
