#!/usr/bin/env bash
# OSS 异地备份上传脚本（阿里云 OSS / ossutil）
#
# - 不含任何密钥：配置全部从项目根目录 .env 的 OSS_* 读取，可安全提交。
# - 自动选择 Endpoint：优先同地域内网（免费），不可达时回退公网；
#   也可用环境变量 OSS_USE_INTERNAL=true|false 强制指定。
# - 若系统无 ossutil，则自动下载官方 ossutil 到 deploy/bin/（不提交）。
# - 由 backup.sh 在本地备份成功后调用：oss-upload.sh <备份文件绝对路径>
# - 本脚本失败只返回非零，不影响已完成的本地备份（backup.sh 会记为警告）。

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"
BIN_DIR="$SCRIPT_DIR/bin"

BACKUP_FILE="${1:?需要传入备份文件路径}"
[ -f "$BACKUP_FILE" ] || { echo "备份文件不存在：$BACKUP_FILE" >&2; exit 1; }
FILE_NAME="$(basename "$BACKUP_FILE")"

# 读取 .env（标准 KEY=VALUE 的 shell 文件，自动导出）
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

OSS_BUCKET="${OSS_BUCKET:-.env 中未配置 OSS_BUCKET}"
OSS_PREFIX="${OSS_PREFIX:-db-backups}"
OSS_ACCESS_KEY_ID="${OSS_ACCESS_KEY_ID:-.env 中未配置 OSS_ACCESS_KEY_ID}"
OSS_ACCESS_KEY_SECRET="${OSS_ACCESS_KEY_SECRET:-.env 中未配置 OSS_ACCESS_KEY_SECRET}"
OSS_ENDPOINT="${OSS_ENDPOINT:-oss-cn-beijing.aliyuncs.com}"
OSS_ENDPOINT_INTERNAL="${OSS_ENDPOINT_INTERNAL:-oss-cn-beijing-internal.aliyuncs.com}"

# 探测 Endpoint 是否可达（只看能否建连，忽略 HTTP 状态码）
reachable() {
  curl -s -o /dev/null --connect-timeout 2 "https://$1"
}

select_endpoint() {
  case "${OSS_USE_INTERNAL:-auto}" in
    true)  echo "$OSS_ENDPOINT_INTERNAL" ;;
    false) echo "$OSS_ENDPOINT" ;;
    auto)
      if reachable "$OSS_ENDPOINT_INTERNAL"; then
        echo "$OSS_ENDPOINT_INTERNAL"
      else
        echo "$OSS_ENDPOINT"
      fi
      ;;
    *) echo "$OSS_ENDPOINT" ;;
  esac
}

OSSUTIL_VERSION="1.7.19"

# 返回适合当前系统的 ossutil 下载包名与 SHA256（官方地址）
ossutil_package() {
  local os arch
  os="$(uname -s)"; arch="$(uname -m)"
  case "$os:$arch" in
    Linux:x86_64)  echo "ossutil-v${OSSUTIL_VERSION}-linux-amd64.zip dcc512e4a893e16bbee63bc769339d8e56b21744fd83c8212a9d8baf28767343" ;;
    Linux:aarch64) echo "ossutil-v${OSSUTIL_VERSION}-linux-arm64.zip f612c2a88d4d28363e254168d521fac5df632f2547ba84eaebacf6497dc04d57" ;;
    Darwin:x86_64) echo "ossutil-v${OSSUTIL_VERSION}-mac-amd64.zip 9cf82a53fe24d8b5cc3dfb441787e0ea19c24dd7a1246653d5f1a28b7923d6fe" ;;
    Darwin:arm64)  echo "ossutil-v${OSSUTIL_VERSION}-mac-arm64.zip 10ece4d328c5d2440833adc5f4167168e9b2a4c5d364f673b0c45bcc4fd02ec5" ;;
    *) return 1 ;;
  esac
}

ensure_ossutil() {
  if command -v ossutil >/dev/null 2>&1; then
    command -v ossutil; return 0
  fi
  if [ -x "$BIN_DIR/ossutil" ]; then
    echo "$BIN_DIR/ossutil"; return 0
  fi

  local pkg sha url tmp
  read -r pkg sha < <(ossutil_package) || {
    echo "不支持的系统/架构，无法自动安装 ossutil。" >&2; return 1
  }
  url="https://gosspublic.alicdn.com/ossutil/${OSSUTIL_VERSION}/${pkg}"

  mkdir -p "$BIN_DIR"
  tmp="$(mktemp -d)"
  echo "首次使用，下载 ossutil ${OSSUTIL_VERSION} ..." >&2
  if ! curl -fsSL --connect-timeout 10 -o "$tmp/ossutil.zip" "$url"; then
    echo "ossutil 下载失败：$url" >&2; rm -rf "$tmp"; return 1
  fi

  local actual
  actual="$(shasum -a 256 "$tmp/ossutil.zip" | awk '{print $1}')"
  if [ "$actual" != "$sha" ]; then
    echo "ossutil 校验和不匹配，放弃安装。" >&2; rm -rf "$tmp"; return 1
  fi

  if command -v unzip >/dev/null 2>&1; then
    unzip -q -o "$tmp/ossutil.zip" -d "$tmp/out"
  else
    mkdir -p "$tmp/out"; python3 -m zipfile -e "$tmp/ossutil.zip" "$tmp/out"
  fi

  local bin
  bin="$(find "$tmp/out" -type f ! -name '*.md' ! -name 'README*' | head -1)"
  [ -n "$bin" ] || { echo "解压后未找到 ossutil 可执行文件。" >&2; rm -rf "$tmp"; return 1; }
  install -m 0755 "$bin" "$BIN_DIR/ossutil"
  rm -rf "$tmp"
  echo "$BIN_DIR/ossutil"
}

ENDPOINT="$(select_endpoint)"
OSSUTIL="$(ensure_ossutil)" || exit 1

# 用临时配置文件传递密钥（chmod 600，退出即删），避免密钥出现在进程参数里
TMP_CONF="$(mktemp)"
cleanup() { rm -f "$TMP_CONF"; }
trap cleanup EXIT
chmod 600 "$TMP_CONF"
cat > "$TMP_CONF" <<EOF
[Credentials]
language=CH
accessKeyId=$OSS_ACCESS_KEY_ID
accessKeySecret=$OSS_ACCESS_KEY_SECRET
endpoint=$ENDPOINT
EOF

echo "上传到 OSS：oss://${OSS_BUCKET}/${OSS_PREFIX}/${FILE_NAME}（endpoint=${ENDPOINT}）"
"$OSSUTIL" cp -f "$BACKUP_FILE" \
  "oss://${OSS_BUCKET}/${OSS_PREFIX}/${FILE_NAME}" \
  -c "$TMP_CONF" -e "$ENDPOINT"
