UPDATE "Order"
SET "status" = 'COMPLETED'
WHERE "paymentStatus" = 'COMPLETED'
  AND "status" NOT IN ('CANCELLED', 'REJECTED');
