ALTER TYPE "BusinessType" ADD VALUE IF NOT EXISTS 'OCCUPATIONAL_HEALTH';

UPDATE "Customer"
SET "monitoringType" = CASE "monitoringType"
  WHEN '年度监测' THEN '年度检测'
  WHEN '验收监测' THEN '验收检测'
  WHEN '水质监测' THEN '水质检测'
  ELSE "monitoringType"
END
WHERE "monitoringType" IN ('年度监测', '验收监测', '水质监测');
