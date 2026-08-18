DROP INDEX IF EXISTS "Contract_contractNumber_key";
DROP INDEX IF EXISTS "Order_orderNumber_key";

CREATE INDEX IF NOT EXISTS "Contract_contractNumber_idx"
ON "Contract"("contractNumber");

CREATE INDEX IF NOT EXISTS "Order_orderNumber_idx"
ON "Order"("orderNumber");
