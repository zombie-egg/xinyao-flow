UPDATE "LeaveRequest" AS leave
SET "status" = 'PENDING_ADMIN'
FROM "User" AS employee
JOIN "Role" AS role ON role.id = employee."roleId"
LEFT JOIN "Department" AS department ON department.id = employee."departmentId"
WHERE leave."userId" = employee.id
  AND leave."status" = 'PENDING_MANAGER'
  AND (role.code IN ('SALES_MANAGER', 'TECH_MANAGER') OR department.code = 'FINANCE');
