# myseviece

基于 **NestJS 10 + TypeScript** 的最小脚手架，内置一个**可配置、与存储厂商解耦**的对象存储模块。当前支持本地占位模式与阿里云 OSS，后续可通过新增适配器接入 S3、七牛、腾讯云等而无需改动业务代码。

## 目录结构

```
myseviece/
├── package.json            # npm workspaces 根配置
├── tsconfig.base.json      # 共享 TS 基础配置
├── docker-compose.yml      # 单服务编排
├── Dockerfile              # 多阶段构建
├── libs/
│   └── shared/             # @app/shared
│       └── src/
│           ├── response/   # 统一响应体 + 拦截器
│           ├── filters/    # 全局异常过滤器
│           ├── decorators/ # @Public()
│           └── storage/    # 存储抽象 + local/oss 适配器
└── services/
    └── server/             # @app/server 唯一可运行服务
        └── src/
            ├── health/     # GET /health
            └── storage-demo/  # 存储能力调用示例
```

## 存储模块设计

- `StorageProvider`：抽象接口，定义 `signedUrl` 与 `createUploadGrant`。
- `LocalStorageProvider`：默认实现，不依赖外部存储，返回相对/可配置基址地址。
- `OssStorageProvider`：阿里云 OSS，支持短时效签名读取与 STS 临时凭证直传。
- `StorageModule.registerAsync(...)`：启动时根据配置选择驱动；设置 `STORAGE_DRIVER=oss` 且 `OSS_*` 齐全时启用 OSS，否则自动回退 local。

迁移到其他厂商时，只需在 `libs/shared/src/storage/providers/` 下新增一个实现 `StorageProvider` 的适配器并在模块中登记。

## 本地开发

```bash
npm install
npm run dev
```

## 容器启动

```bash
cp .env.example .env   # 按需修改配置
npm run docker:up
npm run docker:logs
npm run docker:down
```

## 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/api/storage/info` | 当前驱动与启用状态 |
| GET | `/api/storage/signed-url?key=<key>` | 获取签名读取地址 |
| POST | `/api/storage/upload-grant` | 签发上传凭证，body：`{ category, filename, contentType? }` |

统一响应结构：`{ "code": 0, "message": "success", "data": {} }`。
