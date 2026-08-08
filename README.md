# 企业业务管理系统

Next.js App Router + TypeScript + Tailwind CSS + Prisma + PostgreSQL 构建的企业内部业务系统。

## 启动

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

PostgreSQL 可使用 Docker：

```bash
docker run --name enterprise-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=enterprise_ops -p 5432:5432 -d postgres:16
```

默认管理员账号为 `admin`，也可使用 `.env` 中的 `QQ_EMAIL` 登录。Seed 密码为 `ChangeMe123!`，可通过 `SEED_PASSWORD` 修改。员工通过 `/register` 获取邮箱验证码注册，系统自动生成内部账号并分配角色；管理员账号只能后台创建。

## 订单业务流程

```text
销售创建客户和订单并上传合同
→ 销售经理审核
→ 财务审核
→ 管理员审核并生成 YYYYMMDD + 4 位流水号
→ 技术经理分配给技术员工
→ 技术员工接收并完成任务
→ 财务处理发票
→ 财务分次登记回款
→ 技术完成、发票完成、全额回款后订单自动完成
```

生产环境执行已有迁移使用 `npm run db:deploy`。每天过旷工判定时间后，由调度器调用 `POST /api/internal/attendance/close`，请求头为 `Authorization: Bearer <CRON_SECRET>`。

## 检查

```bash
npm run typecheck
npm test
npm run build
```
