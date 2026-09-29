#!/usr/bin/env bash
# PostgreSQL 定时备份脚本（Linux）
# - 导出整个数据库实例（所有业务库 + 角色定义），gzip 压缩
# - 按时间戳命名，滚动清理过期备份
# - 若存在可执行的 deploy/oss-upload.sh，则在备份成功后调用它上传
#
# 可用环境变量覆盖默认配置：
#   PG_CONTAINER   数据库容器名（默认 platform-postgres）
#   PG_USER        数据库用户（默认读取根目录 .env 的 POSTGRES_USER，再退化为 appuser）
#   BACKUP_DIR     备份输出目录（默认 <项目根>/backups）
#   RETAIN_DAYS    本地备份保留天数（默认 14）

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

PG_CONTAINER="${PG_CONTAINER:-platform-postgres}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"

# 读取 .env 中的 POSTGRES_USER（如果存在）
ENV_FILE="$PROJECT_DIR/.env"
if [ -z "${PG_USER:-}" ] && [ -f "$ENV_FILE" ]; then
  PG_USER="$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | tail -1 | cut -d= -f2-)"
fi
PG_USER="${PG_USER:-appuser}"

mkdir -p "$BACKUP_DIR"
LOG_FILE="$BACKUP_DIR/backup.log"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/pg_all_${TIMESTAMP}.sql.gz"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# 确认 Docker 可用且数据库容器在运行
if ! command -v docker >/dev/null 2>&1; then
  log "错误：未找到 docker 命令，备份终止。"
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  log "错误：数据库容器 $PG_CONTAINER 未运行，备份终止。"
  exit 1
fi

log "开始备份：容器=$PG_CONTAINER 用户=$PG_USER 文件=$BACKUP_FILE"

# 导出整个实例并压缩；PIPESTATUS[0] 是 docker exec 的退出码
if docker exec -i "$PG_CONTAINER" pg_dumpall -U "$PG_USER" | gzip > "$BACKUP_FILE"; then
  :
else
  log "错误：pg_dumpall 执行失败（管道退出码：${PIPESTATUS[*]}）。"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# 检查产物非空
if [ ! -s "$BACKUP_FILE" ]; then
  log "错误：备份文件为空，判定为失败。"
  rm -f "$BACKUP_FILE"
  exit 1
fi

FILE_SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
log "备份完成：${BACKUP_FILE}（${FILE_SIZE}）"

# 滚动清理过期备份
DELETED="$(find "$BACKUP_DIR" -maxdepth 1 -name 'pg_all_*.sql.gz' -type f -mtime "+$RETAIN_DAYS" -print -delete | wc -l | tr -d ' ')"
log "已清理 $RETAIN_DAYS 天前的旧备份，本次删除 $DELETED 个文件。"

# OSS 上传钩子（稍后配置 ossutil / rclone 时提供）
OSS_SCRIPT="$PROJECT_DIR/deploy/oss-upload.sh"
if [ -x "$OSS_SCRIPT" ]; then
  log "调用 OSS 上传脚本：$OSS_SCRIPT"
  if "$OSS_SCRIPT" "$BACKUP_FILE"; then
    log "OSS 上传成功。"
  else
    log "警告：OSS 上传失败（本地备份仍然保留）。"
  fi
else
  log "未配置 OSS 上传脚本（$OSS_SCRIPT 不存在或不可执行），跳过异地上传。"
fi

log "本次备份流程结束。"
exit 0
