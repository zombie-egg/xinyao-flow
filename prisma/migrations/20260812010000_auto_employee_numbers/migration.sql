WITH ranked AS (
  SELECT
    u.id,
    CASE d.code
      WHEN 'FINANCE' THEN 'XYCW'
      WHEN 'SALES' THEN 'XYXS'
      WHEN 'TECH' THEN 'XYJS'
    END AS prefix,
    ROW_NUMBER() OVER (
      PARTITION BY d.code
      ORDER BY u."createdAt", u.id
    ) AS sequence
  FROM "User" u
  JOIN "Department" d ON d.id = u."departmentId"
  WHERE u."employeeNumber" IS NULL
), offsets AS (
  SELECT
    prefix,
    COALESCE(MAX(CASE WHEN "employeeNumber" ~ ('^' || prefix || '[0-9]+$') THEN SUBSTRING("employeeNumber" FROM LENGTH(prefix) + 1)::INTEGER END), 0) AS max_sequence
  FROM (
    SELECT 'XYCW' AS prefix, "employeeNumber" FROM "User"
    UNION ALL SELECT 'XYXS', "employeeNumber" FROM "User"
    UNION ALL SELECT 'XYJS', "employeeNumber" FROM "User"
  ) existing
  GROUP BY prefix
)
UPDATE "User" u
SET "employeeNumber" = ranked.prefix || LPAD((offsets.max_sequence + ranked.sequence)::TEXT, 2, '0')
FROM ranked
JOIN offsets ON offsets.prefix = ranked.prefix
WHERE u.id = ranked.id;
