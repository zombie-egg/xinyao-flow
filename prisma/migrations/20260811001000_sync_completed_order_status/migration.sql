-- Older payment records could be fully paid while the main order status was
-- left in an in-progress state. Keep both fields consistent for filtering.
UPDATE "Order"
SET "status" = 'COMPLETED'
WHERE "paymentStatus" = 'COMPLETED'
  AND "status" <> 'COMPLETED';
