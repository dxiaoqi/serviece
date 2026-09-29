#!/usr/bin/env bash
# OSS 异地备份上传脚本（模板）
#
# 用法：
#   1. 安装 aliyun CLI（ossutil）：https://help.aliyun.com/zh/oss/developer-reference/install-ossutil
#      或改用 rclone（AWS S3 / 腾讯云 COS / Cloudflare R2 等同样适用）。
#   2. 填入下面的 Endpoint / Bucket / 本地凭证配置路径。
#   3. cp 本文件为 oss-upload.sh，填入真实信息后 chmod +x oss-upload.sh。
#   4. backup.sh 检测到可执行的 oss-upload.sh 后会在每次备份成功后自动调用：
#        oss-upload.sh <备份文件绝对路径>
#
# 安全要求：凭证写在 ossutil 自己的配置文件（~/.ossutilconfig）或环境变量里，
# 不要把 AccessKey 直接写进本脚本，更不要把含密钥的文件提交到 Git。

set -uo pipefail

BACKUP_FILE="${1:?需要传入备份文件路径}"
FILE_NAME="$(basename "$BACKUP_FILE")"

# ===== 按需填写（示例为阿里云 OSS）=====
OSS_ENDPOINT="oss-cn-hangzhou.aliyuncs.com"
OSS_BUCKET="your-bucket-name"
OSS_PREFIX="db-backups"          # Bucket 内的目录前缀，可按项目区分
# =======================================

# 方式一：aliyun ossutil（取消注释并配置好 ~/.ossutilconfig 后使用）
# exec ossutil cp -f "$BACKUP_FILE" "oss://$OSS_BUCKET/$OSS_PREFIX/$FILE_NAME" \
#   --endpoint="$OSS_ENDPOINT"

# 方式二：rclone（配置 remote 后使用，适配 OSS / S3 / COS / R2）
# exec rclone copy "$BACKUP_FILE" "your-remote:$OSS_BUCKET/$OSS_PREFIX/"

echo "oss-upload.sh 尚未配置，请参考脚本内注释填写后重命名为 oss-upload.sh。" >&2
exit 1
