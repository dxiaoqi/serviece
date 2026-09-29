#!/usr/bin/env bash
# 容器入口脚本：先执行数据库迁移，成功后再启动服务
# 由 Dockerfile 通过 SERVICE_NAME 环境变量调用。
#
# 行为：
#   - 仅对带数据库的服务（auth-service / stats-service）执行迁移；
#   - 迁移失败立即以非零码退出，阻止服务在错误表结构下运行；
#   - 迁移成功（或无需迁移）后启动 Node 服务。

set -euo pipefail

: "${SERVICE_NAME:?SERVICE_NAME 环境变量未设置}"

SERVICE_DIR="/app/services/${SERVICE_NAME}"

run_migrations() {
  echo "[${SERVICE_NAME}] 启动前执行数据库迁移..."
  node "${SERVICE_DIR}/dist/database/run-migrations.js"
}

case "$SERVICE_NAME" in
  auth-service|stats-service)
    run_migrations
    ;;
  *)
    echo "[${SERVICE_NAME}] 无数据库迁移步骤，直接启动。"
    ;;
esac

echo "[${SERVICE_NAME}] 启动应用..."
exec node "${SERVICE_DIR}/dist/main.js"
