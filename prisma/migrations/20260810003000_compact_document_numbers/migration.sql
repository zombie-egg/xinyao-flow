WITH numbered AS (
  SELECT o.id, o."contractId", u."employeeNumber",
    TO_CHAR(COALESCE(o."approvedAt", o."createdAt") + INTERVAL '8 hours', 'YYYYMMDD') AS day,
    ROW_NUMBER() OVER (
      PARTITION BY u."employeeNumber", TO_CHAR(COALESCE(o."approvedAt", o."createdAt") + INTERVAL '8 hours', 'YYYYMMDD')
      ORDER BY COALESCE(o."approvedAt", o."createdAt"), o.id
    ) AS sequence
  FROM "Order" o JOIN "User" u ON u.id=o."salesUserId"
  WHERE o."approvalStatus"='APPROVED' AND u."employeeNumber" IS NOT NULL
), updated AS (
  UPDATE "Order" o SET "orderNumber"=numbered.day || LPAD(numbered.sequence::text,2,'0') || numbered."employeeNumber"
  FROM numbered WHERE o.id=numbered.id
  RETURNING o.id,o."contractId",o."orderNumber"
)
UPDATE "Contract" c SET "contractNumber"=updated."orderNumber"
FROM updated WHERE c.id=updated."contractId";
