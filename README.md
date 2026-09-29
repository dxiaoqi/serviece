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

## 10. 注意事项与已知限制

- **`synchronize: true`**：各服务当前启用 TypeORM 自动建表，便于快速开发。**上生产前必须改为 Migration 管理**，避免实体改动导致数据丢失或表结构被意外修改。
- **JWT 密钥**：默认值仅用于本地，生产部署务必通过环境变量注入强随机 `JWT_SECRET`。
- **数据库初始化脚本幂等性**：`deploy/init-db.sql` 仅在数据卷首次创建时执行；重建库需先删除 volume（`docker compose down -v`，会清空数据）。
- **端口避让**：如本机端口与现有容器冲突，调整 `docker-compose.yml` 的宿主机映射即可，不要改动容器内端口与服务间 URL。
- 网关代理异常（下游不可达）统一返回 503，便于客户端区分「业务错误」与「基础设施错误」。

## 11. 常用命令速查

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
