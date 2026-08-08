/*
  Warnings:

  - Made the column `amount` on table `Payment` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "public"."OrderApprovalStatus" AS ENUM ('DRAFT', 'PENDING_SALES_MANAGER', 'PENDING_ADMIN', 'APPROVED', 'MANAGER_REJECTED', 'ADMIN_REJECTED');

-- CreateEnum
CREATE TYPE "public"."TechnicalStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED');

-- DropIndex
DROP INDEX "public"."Payment_orderId_key";

-- AlterTable
ALTER TABLE "public"."Contract" ALTER COLUMN "contractNumber" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Customer" ADD COLUMN     "contactInfo" TEXT;

-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "fileType" TEXT,
ADD COLUMN     "fileUrl" TEXT;

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "address" TEXT,
ADD COLUMN     "approvalStatus" "public"."OrderApprovalStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "contact" TEXT,
ADD COLUMN     "contactInfo" TEXT,
ADD COLUMN     "invoiceRequired" BOOLEAN,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '未命名订单',
ADD COLUMN     "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "projectRequirements" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "remark" TEXT,
ADD COLUMN     "technicalStatus" "public"."TechnicalStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "orderNumber" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "financeUserId" TEXT,
ADD COLUMN     "receiptName" TEXT,
ADD COLUMN     "receiptSize" INTEGER,
ADD COLUMN     "receiptType" TEXT,
ADD COLUMN     "receiptUrl" TEXT,
ALTER COLUMN "amount" SET NOT NULL;

-- CreateTable
CREATE TABLE "public"."ContractApproval" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractApproval_orderId_createdAt_idx" ON "public"."ContractApproval"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_orderId_createdAt_idx" ON "public"."Payment"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_financeUserId_fkey" FOREIGN KEY ("financeUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContractApproval" ADD CONSTRAINT "ContractApproval_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContractApproval" ADD CONSTRAINT "ContractApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
