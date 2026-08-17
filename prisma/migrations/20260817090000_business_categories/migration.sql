CREATE TYPE "BusinessCategory" AS ENUM ('XINYAO_ENVIRONMENT', 'OCCUPATIONAL_HEALTH');

ALTER TABLE "Customer"
ADD COLUMN "category" "BusinessCategory" NOT NULL DEFAULT 'XINYAO_ENVIRONMENT';

ALTER TABLE "Order"
ADD COLUMN "category" "BusinessCategory" NOT NULL DEFAULT 'XINYAO_ENVIRONMENT';

DROP INDEX IF EXISTS "Customer_nameNormalized_phoneNormalized_key";
CREATE UNIQUE INDEX "Customer_category_nameNormalized_phoneNormalized_key"
ON "Customer"("category", "nameNormalized", "phoneNormalized");

CREATE INDEX "Customer_category_updatedAt_idx" ON "Customer"("category", "updatedAt");
CREATE INDEX "Order_category_createdAt_idx" ON "Order"("category", "createdAt");
