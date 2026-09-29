#!/bin/bash
# 创建“只读数据库账号”并在各业务库授予只读权限。
# 由 postgres 官方入口在数据卷首次初始化时自动执行（docker-entrypoint-initdb.d）。
# 依赖环境变量：POSTGRES_USER、POSTGRES_READONLY_USER、POSTGRES_READONLY_PASSWORD。
# 注意：本脚本按文件名排序在 init-db.sql 之后执行，此时 auth_db / stats_db 已存在。

set -euo pipefail

ROLE="${POSTGRES_READONLY_USER:?需要 POSTGRES_READONLY_USER}"
PASS="${POSTGRES_READONLY_PASSWORD:?需要 POSTGRES_READONLY_PASSWORD}"
DATABASES=(auth_db stats_db)

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<EOSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROLE}') THEN
    CREATE ROLE ${ROLE} LOGIN PASSWORD '${PASS}';
  END IF;
END
\$\$;
EOSQL

for db in "${DATABASES[@]}"; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" <<EOSQL
GRANT CONNECT ON DATABASE ${db} TO ${ROLE};
GRANT USAGE ON SCHEMA public TO ${ROLE};
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${ROLE};
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ROLE};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${ROLE};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO ${ROLE};
EOSQL
done

echo "只读账号 ${ROLE} 初始化完成。"
