ALTER TABLE "Customer" ADD COLUMN "nameNormalized" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Customer" ADD COLUMN "phoneNormalized" TEXT NOT NULL DEFAULT '';

UPDATE "Customer"
SET "nameNormalized" = lower(trim("name")),
    "phoneNormalized" = regexp_replace(trim("phone"), '[[:space:]()-]', '', 'g');

CREATE TEMP TABLE "CustomerDedup" AS
SELECT id,
       first_value(id) OVER (PARTITION BY "nameNormalized", "phoneNormalized" ORDER BY "createdAt", id) AS keeper,
       row_number() OVER (PARTITION BY "nameNormalized", "phoneNormalized" ORDER BY "createdAt", id) AS position
FROM "Customer";

UPDATE "Contract" AS item
SET "customerId" = dedup.keeper
FROM "CustomerDedup" AS dedup
WHERE item."customerId" = dedup.id AND dedup.position > 1;

UPDATE "Order" AS item
SET "customerId" = dedup.keeper
FROM "CustomerDedup" AS dedup
WHERE item."customerId" = dedup.id AND dedup.position > 1;

DELETE FROM "Customer" AS item
USING "CustomerDedup" AS dedup
WHERE item.id = dedup.id AND dedup.position > 1;

DROP TABLE "CustomerDedup";

CREATE UNIQUE INDEX "Customer_nameNormalized_phoneNormalized_key"
ON "Customer" ("nameNormalized", "phoneNormalized");
