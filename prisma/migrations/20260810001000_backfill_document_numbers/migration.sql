WITH numbered AS (
  SELECT o.id,
    u."employeeNumber",
    TO_CHAR(COALESCE(o."approvedAt", o."createdAt") + INTERVAL '8 hours', 'YYYYMMDD') AS day,
    ROW_NUMBER() OVER (
      PARTITION BY u."employeeNumber", TO_CHAR(COALESCE(o."approvedAt", o."createdAt") + INTERVAL '8 hours', 'YYYYMMDD')
      ORDER BY COALESCE(o."approvedAt", o."createdAt"), o.id
    ) AS sequence
  FROM "Order" o
  JOIN "User" u ON u.id = o."salesUserId"
  WHERE o."approvalStatus" = 'APPROVED' AND u."employeeNumber" IS NOT NULL
)
UPDATE "Order" o
SET "orderNumber" = numbered."employeeNumber" || '-DD-' || numbered.day || '-' || LPAD(numbered.sequence::text, 2, '0')
FROM numbered WHERE numbered.id = o.id;

WITH numbered AS (
  SELECT o."contractId",
    u."employeeNumber",
    TO_CHAR(COALESCE(o."approvedAt", o."createdAt") + INTERVAL '8 hours', 'YYYYMMDD') AS day,
    ROW_NUMBER() OVER (
      PARTITION BY u."employeeNumber", TO_CHAR(COALESCE(o."approvedAt", o."createdAt") + INTERVAL '8 hours', 'YYYYMMDD')
      ORDER BY COALESCE(o."approvedAt", o."createdAt"), o.id
    ) AS sequence
  FROM "Order" o
  JOIN "User" u ON u.id = o."salesUserId"
  WHERE o."approvalStatus" = 'APPROVED' AND u."employeeNumber" IS NOT NULL
)
UPDATE "Contract" c
SET "contractNumber" = numbered."employeeNumber" || '-HT-' || numbered.day || '-' || LPAD(numbered.sequence::text, 2, '0')
FROM numbered WHERE numbered."contractId" = c.id;
