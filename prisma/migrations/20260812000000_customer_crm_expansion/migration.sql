CREATE TYPE "CustomerStatus" AS ENUM ('POTENTIAL','INITIAL_CONTACT','FOLLOWING','WON','LOYAL');

ALTER TABLE "Customer"
ADD COLUMN "businessLine" "BusinessType" NOT NULL DEFAULT 'ENVIRONMENTAL_MONITORING',
ADD COLUMN "monitoringType" TEXT,
ADD COLUMN "industry" TEXT NOT NULL DEFAULT '',
ADD COLUMN "status" "CustomerStatus" NOT NULL DEFAULT 'POTENTIAL',
ADD COLUMN "nature" TEXT;
ALTER TABLE "Customer" ADD COLUMN "createdById" TEXT;
UPDATE "Customer" SET "createdById"="ownerId";
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "Customer" c SET "status"='WON'
WHERE EXISTS (SELECT 1 FROM "Order" o WHERE o."customerId"=c.id AND o."approvalStatus"='APPROVED');

CREATE TABLE "CustomerContactMethod" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "label" TEXT,
  "value" TEXT NOT NULL,
  "normalized" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerContactMethod_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CustomerContactMethod_customerId_idx" ON "CustomerContactMethod"("customerId");
CREATE INDEX "CustomerContactMethod_normalized_idx" ON "CustomerContactMethod"("normalized");
ALTER TABLE "CustomerContactMethod" ADD CONSTRAINT "CustomerContactMethod_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CustomerCollaborator" (
  "customerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerCollaborator_pkey" PRIMARY KEY ("customerId","userId")
);
CREATE INDEX "CustomerCollaborator_userId_idx" ON "CustomerCollaborator"("userId");
ALTER TABLE "CustomerCollaborator" ADD CONSTRAINT "CustomerCollaborator_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerCollaborator" ADD CONSTRAINT "CustomerCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CustomerContactMethod" (id,"customerId",label,value,normalized)
SELECT 'migrated-phone-' || id,id,'电话',phone,regexp_replace(lower(trim(phone)),'[[:space:]()\-]','','g') FROM "Customer" WHERE trim(phone)<>'';
INSERT INTO "CustomerContactMethod" (id,"customerId",label,value,normalized)
SELECT 'migrated-other-' || id,id,'其他',"contactInfo",lower(regexp_replace(trim("contactInfo"),'[[:space:]]','','g')) FROM "Customer" WHERE COALESCE(trim("contactInfo"),'')<>'';
