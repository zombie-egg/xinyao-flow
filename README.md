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

默认管理员账号为 `admin`，也可使用 `.env` 中的 `QQ_EMAIL` 登录。登录页支持密码登录和邮箱验证码登录，并提供邮箱注册、找回密码。Seed 密码为 `ChangeMe123!`，可通过 `SEED_PASSWORD` 修改。员工通过 `/register` 获取邮箱验证码注册，系统自动生成内部账号并分配角色；管理员账号只能后台创建。

头像、企业 Logo、合同、发票和回款票据统一保存到 `UPLOAD_DIR`（未配置时使用 `public/uploads`）。生产部署应将该目录挂载到持久化卷，应用通过 `/uploads/*` 路由读取文件。

## 订单业务流程

```text
销售创建客户和订单并上传合同
（合同编号按 YYYYMMDD + 2 位流水号 + 销售工号即时生成）
→ 销售经理审核
→ 财务审核
→ 管理员审核通过并将同一编号写入订单号
→ 技术经理分配给技术员工
→ 技术员工接收并完成任务
→ 财务处理发票
→ 财务分次登记回款
→ 技术完成、发票完成、全额回款后订单自动完成
```

新建订单时同时登记应收款，编号为 `PMO.<订单号>`。预计回款日期已过且未足额回款时，财务回款待办会标记“客户逾期”。合同审核被拒后，负责销售可以修改并重新提交，或直接取消订单。

客户管理采用负责销售与协同销售权限：普通销售仅能查看自己负责或协同的客户；销售经理、财务和管理员可以查看全部客户。客户状态由业务人员手动维护，客户明细页集中展示联系方式、跟进流水和历史订单。

生产环境执行已有迁移使用 `npm run db:deploy`。每天过旷工判定时间后，由调度器调用 `POST /api/internal/attendance/close`，请求头为 `Authorization: Bearer <CRON_SECRET>`。

## 检查

```bash
npm run typecheck
npm test
npm run build
```
