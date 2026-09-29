#!/usr/bin/env bash
# 安装 / 卸载数据库定时备份任务（Linux crontab）
#
# 用法：
#   bash deploy/install-schedule.sh               # 安装：每天 03:30 自动备份
#   bash deploy/install-schedule.sh --uninstall   # 从 crontab 移除
#
# 说明：任务写入执行本脚本的当前用户 crontab。建议使用部署该服务的同一用户运行。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_SCRIPT="$PROJECT_DIR/deploy/backup.sh"
CRON_MARK="# myseviece-pg-backup"
CRON_LINE="30 3 * * * /bin/bash $BACKUP_SCRIPT >> $PROJECT_DIR/backups/cron.log 2>&1 $CRON_MARK"

if [ "$(uname -s)" != "Linux" ]; then
  echo "本脚本仅支持 Linux（crontab）。" >&2
  exit 1
fi

if ! command -v crontab >/dev/null 2>&1; then
  echo "未找到 crontab，请先安装 cron（如 Debian/Ubuntu：apt-get install cron）。" >&2
  exit 1
fi

chmod +x "$BACKUP_SCRIPT"
mkdir -p "$PROJECT_DIR/backups"

if [ "${1:-}" = "--uninstall" ]; then
  crontab -l 2>/dev/null | grep -v "$CRON_MARK" | crontab - || true
  echo "已从 crontab 移除备份任务。"
  exit 0
fi

( crontab -l 2>/dev/null | grep -v "$CRON_MARK"; echo "$CRON_LINE" ) | crontab -
echo "crontab 已安装，每天 03:30 自动备份。"
echo "验证：crontab -l | grep myseviece"
