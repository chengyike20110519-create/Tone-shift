#!/usr/bin/env bash
# Tone-shift 本地预览：直接跑这个就行
# 用法：bash start.sh        （前台，按 Ctrl+C 停）
#       bash start.sh --open （起好后自动打开浏览器）
set -e
cd "$(dirname "$0")"
PORT="${PORT:-8000}"
HOST="${HOST:-127.0.0.1}"
URL="http://${HOST}:${PORT}/"

if lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "端口 ${PORT} 已被占用："
  lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN
  exit 1
fi

echo "▶ Tone-shift 后端 + 前端在 ${URL}"
echo "  REST API → ${URL}api/v1/health"
if [[ "${1:-}" == "--open" ]]; then
  (sleep 0.8 && open "${URL}") &
fi
HOST="$HOST" PORT="$PORT" exec node server/src/index.js
