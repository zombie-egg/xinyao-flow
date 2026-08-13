ALTER TABLE "Customer"
ADD COLUMN "isPublicPool" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Customer"
ALTER COLUMN "ownerId" DROP NOT NULL;

ALTER TABLE "Customer"
DROP CONSTRAINT IF EXISTS "Customer_ownerId_fkey";

ALTER TABLE "Customer"
ADD CONSTRAINT "Customer_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Customer_isPublicPool_updatedAt_idx"
ON "Customer"("isPublicPool", "updatedAt");
