# myseviece 微服务后端平台

> 本文档面向 AI Agent 与开发者，说明本平台的架构、约定、接口规范以及如何安全地扩展新服务。
> 修改代码前请先阅读「开发约定」与「如何新增一个服务」两节。

## 1. 项目简介

基于 **NestJS 10 + TypeScript + PostgreSQL 16** 的微服务后端平台，用于快速搭建各类接口服务（认证、统计、下载量等）。

- 物理形态：**npm workspaces monorepo**（一个 Git 仓库，多个独立可部署服务）。
- 每个服务是独立的 NestJS 工程，可单独构建、单独打包、单独扩容。
- 服务间通过 HTTP 通信，外部统一经由 API 网关访问。

## 2. 架构与端口

```
                         ┌─────────────────────┐
  Client ─── HTTP ──────▶│     api-gateway      │  统一入口 / 鉴权 / 限流 / 代理
                         └──────────┬───────────┘
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
          ┌─────────────────┐           ┌─────────────────┐
          │  auth-service    │           │  stats-service   │
          │ 注册/登录/JWT    │           │ 下载量统计       │
          └────────┬────────┘           └────────┬────────┘
                   ▼                             ▼
          ┌─────────────────┐           ┌─────────────────┐
          │ PostgreSQL       │           │ PostgreSQL       │
          │ database: auth_db│           │ database: stats_db│
          └─────────────────┘           └─────────────────┘
```

| 服务 | 容器内端口 | 宿主机端口 | 数据库 |
|------|-----------|-----------|--------|
| api-gateway | 3000 | **3005** | — |
| auth-service | 3001 | 3001 | auth_db |
| stats-service | 3002 | 3002 | stats_db |
| postgres | 5432 | **5433** | 实例内含 auth_db / stats_db |

> 宿主机端口非标准值（3005 / 5433），是为了避让本机其他项目占用的 3000 / 5432。容器内部服务间通信仍使用标准端口（如 `http://auth-service:3001`）。修改映射请编辑 `docker-compose.yml`。

## 3. 目录结构

```
myseviece/
├── package.json                 # 根 workspace 配置与 npm scripts
├── tsconfig.base.json           # 所有包共享的 TS 基础配置
├── .env                         # docker-compose 使用的环境变量（密钥/端口）
├── Dockerfile                   # 多服务共用的多阶段构建文件，通过 SERVICE_NAME 参数区分
├── docker-compose.yml           # 本地一键编排（postgres + 3 个服务）
├── deploy/
│   └── init-db.sql              # PostgreSQL 首次启动时创建 auth_db / stats_db
├── libs/
│   └── shared/                  # @app/shared 共享库
│       └── src/
│           ├── response/        # 统一响应体 ApiResponse + ResponseInterceptor
│           ├── filters/         # 全局异常过滤器 AllExceptionsFilter
│           ├── guards/          # JwtAuthGuard
│           ├── decorators/      # @CurrentUser / @Public
│           └── types/           # JwtPayload / 数据库配置辅助
└── services/
    ├── api-gateway/             # @app/api-gateway
    ├── auth-service/            # @app/auth-service
    └── stats-service/           # @app/stats-service
```

单个服务内部统一采用 NestJS 标准结构：

```
service-name/
├── package.json
├── tsconfig.json
├── .env                         # 本地 npm run dev 时读取（非 docker 场景）
└── src/
    ├── main.ts                  # 启动入口（全局前缀 /api，注册拦截器与过滤器）
    ├── app.module.ts            # 根模块（TypeORM 连接、业务模块装配）
    └── <domain>/                # 按领域划分：entity / dto / service / controller / module
```

## 4. 快速开始

### 前置要求

- Node.js >= 20
- Docker Desktop（含 docker compose v2）

### 使用 Docker 一键启动（推荐）

```bash
npm run docker:up      # 构建镜像并后台启动全部服务
npm run docker:logs    # 跟踪全部日志
npm run docker:down    # 停止并移除容器
```

启动后：

- 网关健康检查：`GET http://localhost:3005/health`
- 接口基址：`http://localhost:3005/api`

### 本地开发模式（不走容器，需自行保证数据库可达）

```bash
npm install                 # 安装全部 workspace 依赖
npm run build:shared        # 必须先构建共享库（其它服务引用其 dist 产物）
npm run dev:auth            # 启动 auth-service（ts-node-dev 热重载）
npm run dev:stats           # 启动 stats-service
npm run dev:gateway         # 启动 api-gateway
```

### 全量构建校验

```bash
npm run build               # 依次构建 shared 与所有服务（CI 中用于类型检查）
```

## 5. 统一接口规范

### 5.1 响应格式

所有接口统一返回如下结构（由 `ResponseInterceptor` 自动包装）：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

- `code = 0` 表示业务成功；非 0 表示错误。
- 控制器内只需返回原始数据，不要手动包装。
- 例外：健康检查 `GET /health` 直接返回原始对象，不经过包装。

### 5.2 错误码约定

错误由 `AllExceptionsFilter` 统一捕获。HTTP 状态码与业务码 `code` 对应规则：

| HTTP 状态 | 业务 code（默认） | 含义 |
|-----------|------------------|------|
| 400 | 40000 | 参数校验失败 |
| 401 | 40100 | 未登录 / Token 无效或过期 |
| 403 | 40300 | 无权限 |
| 404 | 40400 | 资源不存在 |
| 409 | 40900 | 资源冲突（如用户名已存在） |
| 429 | 42900 | 触发限流 |
| 500 | 50000 | 服务器内部错误 |
| 503 | 50300 | 下游服务不可用（网关代理失败） |

抛出错误时使用 NestJS 内置异常类即可，例如：

```ts
throw new ConflictException('用户名已被注册');
throw new UnauthorizedException('用户名或密码错误');
```

### 5.3 参数校验

每个服务在 `main.ts` 中全局启用了 `ValidationPipe`（`whitelist: true`、`transform: true`）。所有入参通过 DTO + `class-validator` 装饰器声明约束，校验失败会被转换为 400 响应。

### 5.4 鉴权约定

- 认证方式：HTTP Header `Authorization: Bearer <JWT>`。
- JWT 载荷结构（见 `@app/shared` 的 `JwtPayload`）：

```json
{ "sub": "<userId:uuid>", "username": "<string>", "email": "<string>" }
```

- 在需要登录的控制器/方法上加 `@UseGuards(JwtAuthGuard)`；公开接口加 `@Public()`。
- 通过 `@CurrentUser()` 获取当前用户，或 `@CurrentUser('sub')` 获取用户 ID。
- 注意：网关与下游服务会做**双重**鉴权。网关先校验 Token 再代理；服务内部同样可启用 `JwtAuthGuard`。公开路径需在两处分别放行（见下节）。

### 5.5 网关公开路径

网关默认拦截所有 `/api/*` 请求并要求 Token。公开路径白名单硬编码在：

`services/api-gateway/src/middleware/auth.middleware.ts` 的 `PUBLIC_PATHS`。

新增公开接口时，必须在此处登记（按 HTTP method + path 前缀匹配）。

## 6. API 清单

所有路径均相对网关基址 `http://localhost:3005`。

### 6.1 认证服务 auth-service（前缀 `/api/auth`）

| 方法 | 路径 | 鉴权 | 请求体 / 参数 | 说明 |
|------|------|------|---------------|------|
| POST | `/api/auth/register` | 公开 | `{ username, email, password }` | 注册，返回 token + user |
| POST | `/api/auth/login` | 公开 | `{ username, password }` | 登录，返回 token + user |
| GET | `/api/auth/profile` | 需要 | — | 获取当前登录用户信息 |

注册/登录成功返回的 `data` 结构：

```json
{
  "token": "<JWT>",
  "user": { "id": "<uuid>", "username": "<string>", "email": "<string>" }
}
```

字段约束：`username` 3–32 字符且仅含字母数字下划线；`email` 须为合法邮箱；password` 至少 6 位。

### 6.2 统计服务 stats-service（前缀 `/api/stats`）

| 方法 | 路径 | 鉴权 | 参数 | 说明 |
|------|------|------|------|------|
| POST | `/api/stats/downloads/track` | 公开 | body: `{ appKey, platform?, version? }` | 上报一次下载 |
| GET | `/api/stats/downloads/count` | 公开 | `appKey?, startDate?, endDate?` | 下载总量 |
| GET | `/api/stats/downloads/trend` | 公开 | `appKey?, days=`（1–90，默认 7） | 按日趋势（补齐无数据日期为 0） |
| GET | `/api/stats/downloads/ranking` | 公开 | `limit=`（1–100，默认 10） | 按 appKey 的下载量排行 |
| GET | `/api/stats/downloads/platforms` | 公开 | `appKey?` | 按平台分布 |

- `appKey`：仅允许字母、数字、下划线、中划线、点，长度 ≤ 64。
- `startDate` / `endDate`：格式 `YYYY-MM-DD`。
- `track` 接口会自动记录来源 IP（兼容 `x-forwarded-for`）与 User-Agent。

## 7. 环境变量

### 根目录 `.env`（docker-compose 使用）

| 变量 | 说明 |
|------|------|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | 数据库账号密码 |
| `JWT_SECRET` | JWT 签名密钥，**生产环境必须修改** |
| `GATEWAY_PORT` / `AUTH_SERVICE_PORT` / `STATS_SERVICE_PORT` | 各服务容器内监听端口 |

### 各服务 `.env`（仅本地 `npm run dev` 使用，容器内由 compose 注入）

- `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD`
- `AUTH_DB_NAME` / `STATS_DB_NAME`：连接的数据库名
- `AUTH_SERVICE_URL` / `STATS_SERVICE_URL`：网关转发目标
- 各服务 `*_PORT`：监听端口

## 8. 开发约定（Agent 必须遵守）

1. **不要手动包装响应**。控制器返回原始数据即可，统一响应由拦截器处理。
2. **异常使用 NestJS 内置 HttpException 子类**（`BadRequestException`、`ConflictException`、`NotFoundException`、`UnauthorizedException` 等），错误信息写中文用户可读文案。
3. **所有入参定义 DTO** 并用 `class-validator` 约束，不接收未声明字段。
4. **实体可空字段必须显式声明列类型**，例如 `@Column({ type: 'varchar', length: 32, nullable: true })`。仅写 `string | null` 联合类型会导致 TypeORM 无法反射推断列类型而启动失败。
5. **跨服务复用的逻辑放 `@app/shared`**；修改 shared 后必须重新 `npm run build:shared`，服务引用的是其 `dist` 产物。
6. **命名规范**：服务包名 `@app/<name>-service`；目录/文件用 kebab-case；类名用 PascalCase；DTO 以 `.dto.ts` 结尾，实体以 `.entity.ts` 结尾。
7. **一个领域一个模块**：`<domain>.module.ts` 聚合 entity、service、controller，再由 `app.module.ts` 引入。
8. 与数据库交互优先使用 **TypeORM Repository / QueryBuilder**，不要手写字符串拼接 SQL（防止注入）。
9. 遵循既有代码风格，不要引入新框架；新增依赖前先检查其它服务是否已使用。
10. **禁止在生产环境依赖 `synchronize` 自动建表/改表**。任何表结构变更都必须通过 Migration 落地：修改实体 → 生成迁移 → 本地校验 → 提交代码，由容器启动流程自动执行（详见 10.5）。已提交的迁移文件视为历史，不得再修改或删除。

## 9. 如何新增一个服务

以新增 `order-service`（服务名 `<name>-service`）为例：

1. **建目录与工程文件**：在 `services/order-service/` 下创建：
   - `package.json`：复制现有服务，改 `name` 为 `@app/order-service`，按需调整依赖（务必包含 `@nestjs/platform-express`）。
   - `tsconfig.json`：直接复制现有服务内容（继承 `../../tsconfig.base.json`）。
   - `.env`：复制并改数据库名（如 `ORDER_DB_NAME=order_db`）与端口（如 3003）。
2. **编写代码**：创建 `src/main.ts`、`src/app.module.ts` 及领域模块，仿照 auth/stats 服务。
3. **创建数据库**：
   - 在 `deploy/init-db.sql` 追加 `CREATE DATABASE order_db;`（仅对首次初始化的新数据卷生效）。
   - 若数据卷已存在，需手动 `docker exec -it platform-postgres createdb -U <user> order_db`。
4. **网关注入路由**：
   - 在 `services/api-gateway/src/main.ts` 增加 `app.use(createServiceProxy('/api/orders', orderTarget));` 及对应目标变量。
   - 若为公开接口，还要在 `auth.middleware.ts` 的 `PUBLIC_PATHS` 登记，否则默认要求登录。
5. **编排服务**：在 `docker-compose.yml` 增加该服务，配置 `build.args.SERVICE_NAME`、环境变量、端口映射与 `depends_on`。
6. **验证**：`npm install` → `npm run build`（类型检查全绿）→ `npm run docker:up` → 用 curl 打通主路径。

> 根 workspace 通过 `"workspaces": ["libs/*", "services/*"]` 自动纳入新目录，无需手动登记。

## 10. 运维指南（Agent 执行运维操作前必读）

> 原则：**改动最小化**——改谁动谁，不要为了单点变更重启全部服务；任何涉及数据的操作，先备份再执行。

### 10.1 服务更新与重启

日常调整遵循「改谁重建谁」。`docker compose up -d` 只会重建配置/镜像发生变化的服务，未改动的容器保持运行。

| 变更内容 | 执行操作 | 影响范围 |
|----------|---------|---------|
| 某个服务的业务代码 | `docker compose up -d --build <服务名>` | 仅该服务，重建期间其请求有秒级中断 |
| 网关路由 / 公开路径白名单 | `docker compose up -d --build api-gateway` | 仅网关，重启秒级内新请求无法进入 |
| `docker-compose.yml`（环境变量、端口、新服务） | `docker compose up -d` | 仅配置变化的服务，Compose 自动比对 |
| 实体（entity）字段 | 重启对应服务（当前 `synchronize: true` 自动同步表结构） | 仅该服务 |
| `libs/shared` 共享库 | `npm run build:shared` 后重建所有引用它的服务 | 可能是全部服务 |
| 数据库初始化脚本 / 数据库账号密码 | `docker compose down` 后重新 `up` | 全部服务 |

可用的 `<服务名>`：`api-gateway`、`auth-service`、`stats-service`、`postgres`。

完整停止与重启：

```bash
docker compose down          # 停止并移除所有容器、网络（保留数据卷，数据不丢）
docker compose down -v       # 同时删除数据卷——会清空数据库！无备份时禁止使用
docker compose up -d         # 重新启动
```

> 单个服务重建时会有几秒该服务不可用。若业务不能接受中断，需要双实例 + 灰度方案（见 10.8）。

### 10.2 状态检查与健康检查

```bash
docker compose ps                 # 查看各容器运行状态（注意 STATUS / HEALTH 列）
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
curl -s http://localhost:3005/health          # 网关健康检查
curl -s http://localhost:3001/health          # 直连 auth-service（绕过网关）
curl -s http://localhost:3002/health          # 直连 stats-service
```

健康的判断标准：4 个容器均为 `Up`，其中 `postgres` 为 `healthy`；`/health` 返回 HTTP 200。

### 10.3 日志排查

```bash
docker compose logs -f                    # 跟踪全部服务日志
docker compose logs -f auth-service       # 只跟踪某一个服务
docker compose logs --tail=100 stats-service
docker compose logs --since=30m api-gateway
```

排查顺序建议：先看网关日志确认请求是否进入、是否被鉴权拦截或代理失败（503）；再看对应下游服务日志；涉及连接报错再看 postgres 日志。

### 10.4 数据库备份与恢复

数据库容器名 `platform-postgres`，实例内有 `auth_db`、`stats_db` 两个库。以下命令在项目根目录执行（账号取 `.env` 中的 `POSTGRES_USER`，默认 `appuser`）。

**备份（导出为 SQL 文件，建议按日期命名）：**

```bash
# 备份单个库
docker exec platform-postgres pg_dump -U appuser auth_db > backups/auth_db_$(date +%Y%m%d).sql
docker exec platform-postgres pg_dump -U appuser stats_db > backups/stats_db_$(date +%Y%m%d).sql

# 一次性备份整个实例（含两个库与角色定义）
docker exec platform-postgres pg_dumpall -U appuser > backups/pg_all_$(date +%Y%m%d).sql
```

**恢复：**

```bash
# 恢复单个库（目标库需已存在）
cat backups/auth_db_20260929.sql | docker exec -i platform-postgres psql -U appuser -d auth_db

# 恢复整个实例
cat backups/pg_all_20260929.sql | docker exec -i platform-postgres psql -U appuser
```

注意事项：

- 执行备份前先确认磁盘剩余空间足够；备份文件不要提交到 Git（`backups/` 已建议忽略，如未忽略需加入 `.gitignore`）。
- 做表结构变更、删除数据、升级版本等高危操作前，**必须先备份**。
- 数据卷物理位置可用 `docker volume inspect <卷名>` 查看，但不要直接操作卷内文件，备份一律走 `pg_dump`。

### 10.5 数据库迁移（Migration）

生产环境关闭了 TypeORM 的 `synchronize`，表结构变更一律通过 Migration 管理，保证结构可追溯、可重放。

**运行机制**

- 每个服务各有一套独立迁移：auth-service 操作 `auth_db`，stats-service 操作 `stats_db`。
- 容器入口 [start-service.sh](deploy/start-service.sh) 会**先执行迁移、成功后再启动应用**；迁移失败则容器退出（fail-fast，不会带错启动）。
- 迁移记录保存在各库的 `typeorm_migrations` 表，重复执行自动跳过，是幂等的。

**日常开发（改表）流程**

1. 修改/新增对应实体（`*.entity.ts`）。
2. 在服务目录生成迁移（示例为 auth-service）：

   ```bash
   npm run migration:generate -w @app/auth-service -- src/migrations/AddUserPhone
   ```

3. 检查生成的迁移，确认 `up` / `down` 符合预期（尤其删列、删表等不可逆操作）。
4. 本地执行并回滚一次，确认双向可用：

   ```bash
   npm run migration:run    -w @app/auth-service
   npm run migration:revert -w @app/auth-service
   npm run migration:run    -w @app/auth-service
   ```

5. 提交迁移文件与代码；部署时容器启动会自动应用。

**容器内手动命令**（按需，连接信息由 compose 注入）

```bash
# 直接执行（幂等）
docker exec platform-auth  node services/auth-service/dist/database/run-migrations.js
docker exec platform-stats node services/stats-service/dist/database/run-migrations.js

# 回滚最近一个迁移（使用编译后的 DataSource）
docker exec -w /app/services/auth-service platform-auth \
  npx typeorm migration:revert -d dist/database/data-source.js
```

**注意事项**

- 迁移文件名前缀为时间戳，决定执行顺序，请勿手工改名。
- 已提交、已上线的迁移不得再编辑；需修正请新增一个迁移。
- 本地 `npm run dev` 默认仍开启 `synchronize` 以便快速开发，但最终结构以迁移为准。
- 执行迁移前建议先按 10.4 备份一次。

### 10.6 一台服务器运行多套环境

同一台服务器可以并行运行多个 Compose 项目，Compose 用**项目名**（默认取目录名）隔离容器名、网络和数据卷。

```bash
docker compose -p env-a up -d           # 在不同目录或用 -p 指定不同项目名
docker compose -p env-b up -d
docker compose ls                        # 查看正在运行的所有 Compose 项目
```

并行多套时必须处理三个冲突点：

1. **`container_name` 冲突**：当前 compose 文件写死了 `platform-postgres` 等全局唯一的容器名，同机起第二套会报名称冲突。多实例场景应删掉 `container_name`，改用 Compose 自动生成的 `<项目名>-<服务名>-1`。
2. **宿主机端口冲突**：每套环境的宿主机端口必须不同。建议把映射参数化（如 `"${GATEWAY_HOST_PORT:-3005}:3000"`），每套通过独立的 `--env-file` 注入端口，不改 compose 本体。
3. **网络隔离**：不同 Compose 项目网络互不相通，不能跨项目用服务名访问。多项目对外建议在最前面加一层主机级 Nginx，按域名（如 a.example.com / b.example.com）分流到各自端口。

多套环境各自使用独立数据卷时，数据库天然隔离；若多套服务共用一个 Postgres 实例，则必须为每套使用不同的库名。

### 10.7 常见故障与处理

| 现象 | 可能原因 | 处理方式 |
|------|---------|---------|
| 容器反复重启 / `Exited` | 配置错误、数据库未就绪 | `docker compose logs <服务名>` 看启动报错 |
| postgres 一直 `unhealthy` | 数据卷损坏或初始化异常 | 看 postgres 日志；必要时备份后 `down -v` 重建（会清数据） |
| 接口返回 401「缺少登录令牌」 | 访问了需登录接口但未带 Token，或公开路径未登记 | 补 `Authorization` 头；公开接口需在网关 `PUBLIC_PATHS` 登记 |
| 接口返回 503 | 网关到下游服务的代理失败，下游不可达 | 检查下游容器状态与服务间 URL、端口 |
| 接口返回 429 | 触发网关限流 | 降低请求频率或调整限流配置 |
| 改了代码但行为没变 | 未重建镜像 / 浏览器或客户端缓存 | `--build` 重建对应服务；容器内确认代码已更新 |
| 端口绑定失败 `address already in use` | 宿主机端口被其他容器/进程占用 | 修改 compose 宿主机端口映射，不要改容器内端口 |
| 服务启动报实体列类型推断错误 | 可空列未显式声明类型 | 按「开发约定」第 4 条写全 `@Column({ type: ..., nullable: true })` |
| 表结构变更后数据异常 | `synchronize` 自动同步删除/重命名了列 | 从备份恢复；危险变更前先备份并考虑改用 Migration |

### 10.8 灰度发布现状

当前架构**不支持开箱即用的灰度发布**：网关代理目标为固定下游地址（见 `proxy.factory.ts`），且每个服务只有一个容器，更新方式是「旧容器停、新容器起」的替换式发布。

如需灰度，推荐在现有网关扩展轻量分流（成本最低）：

- Compose 内为同一服务同时部署稳定版与 canary 版两个容器；
- 网关代理支持按请求头（如 `x-canary: true`）、JWT 用户白名单、权重比例决定转发目标；
- 验证 canary 版本无误后逐步提高权重至 100%，再下线旧容器。

灰度的配套前提：数据库变更向后兼容（先加字段、兼容读写、全量后再清理）、镜像保留可回滚的版本标签、新旧版本日志与指标可区分（如响应头标记 `x-served-by`）。

### 10.9 版本发布流程（Git）

- 日常提交：`git add` → `git commit -m "feat/fix: 中文说明"` → `git push`。
- **禁止提交 `.env` 等含密钥的文件**；新增配置项时同步更新对应的 `.env.example`（占位值）。
- 里程碑版本打带注释的标签并推送：

```bash
git tag -a v1.1.0 -m "发布 v1.1.0：<变更摘要>"
git push origin v1.1.0
```

标签命名遵循语义化版本 `vMAJOR.MINOR.PATCH`。标签推送到 GitHub 后，可在 Releases 页面基于标签编写发布说明。镜像建议使用与标签一致的版本号，不要只依赖 `latest`，以便随时回滚。

## 11. 注意事项与已知限制

- **`synchronize: true`**：各服务当前启用 TypeORM 自动建表，便于快速开发。**上生产前必须改为 Migration 管理**，避免实体改动导致数据丢失或表结构被意外修改。
- **JWT 密钥**：默认值仅用于本地，生产部署务必通过环境变量注入强随机 `JWT_SECRET`。
- **数据库初始化脚本幂等性**：`deploy/init-db.sql` 仅在数据卷首次创建时执行；重建库需先删除 volume（`docker compose down -v`，会清空数据）。
- **端口避让**：如本机端口与现有容器冲突，调整 `docker-compose.yml` 的宿主机映射即可，不要改动容器内端口与服务间 URL。
- 网关代理异常（下游不可达）统一返回 503，便于客户端区分「业务错误」与「基础设施错误」。

## 12. 常用命令速查

```bash
npm install                 # 安装全部依赖
npm run build               # 构建 shared + 所有服务（含完整类型检查）
npm run build:shared        # 仅构建共享库
npm run dev:auth            # 本地热重载 auth-service
npm run dev:stats           # 本地热重载 stats-service
npm run dev:gateway         # 本地热重载 gateway
npm run docker:up           # 容器一键启动
npm run docker:down         # 停止
npm run docker:logs         # 查看容器日志
```

快速冒烟测试（服务运行后）：

```bash
curl -s http://localhost:3005/health
curl -s -X POST http://localhost:3005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo"}'
```
