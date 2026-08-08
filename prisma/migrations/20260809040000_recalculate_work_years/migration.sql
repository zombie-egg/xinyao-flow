WITH calculated AS (
  SELECT id,
         GREATEST(0, date_part('year', age((now() AT TIME ZONE 'Asia/Shanghai')::date, "employmentStartDate"::date))::integer) AS years
  FROM "User"
)
UPDATE "User" AS employee
SET "workYears" = calculated.years,
    "annualLeaveDays" = GREATEST(calculated.years::numeric, employee."annualLeaveUsed")
FROM calculated
WHERE employee.id = calculated.id;
