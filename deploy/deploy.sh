#!/bin/bash

# ===================================================
# 听雨·禅意 3D 空间 (Zhuyu) 一键打包发版脚本
# ===================================================

set -e

# 获取脚本与项目根目录绝对路径 (兼容 sh 与 bash)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

# 临时 SSH 套接字变量与全局安全清理钩子 (顶层定义以保证 sh/bash 完全兼容)
SSH_SOCKET=""
cleanup() {
  if [ -n "$SSH_SOCKET" ] && [ -e "$SSH_SOCKET" ]; then
    ssh -o ControlPath="$SSH_SOCKET" -O exit "$SERVER_USER@$SERVER_HOST" 2>/dev/null || true
    rm -f "$SSH_SOCKET" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "=================================================="
echo " 🎋 听雨·禅意 3D 空间 开始发版部署"
echo "=================================================="

# 1. 优先读取 deploy/.env 配置文件
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
  echo "📄 已成功载入环境配置: deploy/.env"
fi

APP_NAME="${APP_NAME:-zhuyu-zen}"
APP_PORT="${APP_PORT:-8080}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_HOST="${SERVER_HOST:-}"
SERVER_SSH_PORT="${SERVER_SSH_PORT:-22}"
SERVER_DIR="${SERVER_DIR:-/opt/zhuyu-zen}"

# 2. 本地执行生产构建 (产物输出至 dist/)
echo "📦 [1/3] 正在构建前端 React 3D 生产包..."
npm run build

# 3. 判断部署目标（本地 Docker 运行 还是 远端云服务器部署）
if [ -z "$SERVER_HOST" ]; then
  echo ""
  echo "💡 提示：当前未在 deploy/.env 中配置远程服务器 SERVER_HOST"
  read -p "👉 请选择发版目标 [1: 输入远程服务器IP部署 / 2: 在本机 Docker 直接运行] (默认: 2): " DEPLOY_MODE
  DEPLOY_MODE="${DEPLOY_MODE:-2}"

  if [ "$DEPLOY_MODE" = "1" ]; then
    read -p "🔑 请输入目标服务器 IP 地址或域名 (SERVER_HOST): " SERVER_HOST
    if [ -z "$SERVER_HOST" ]; then
      echo "❌ 错误: 服务器主机地址不能为空，发版终止。"
      exit 1
    fi
  fi
fi

if [ -n "$SERVER_HOST" ]; then
  # 远程云服务器部署模式
  echo "--------------------------------------------------"
  echo "📍 目标服务器: $SERVER_USER@$SERVER_HOST (SSH端口: $SERVER_SSH_PORT)"
  echo "📍 部署目录: $SERVER_DIR"
  echo "📍 对外端口: $APP_PORT"
  echo "--------------------------------------------------"

  # 配置 SSH ControlMaster 会话复用 (只需输入 1 次密码，后续命令自动走本地加密隧道)
  SSH_SOCKET_DIR="$HOME/.ssh/sockets"
  mkdir -p -m 700 "$SSH_SOCKET_DIR" 2>/dev/null || SSH_SOCKET_DIR="/tmp"
  SSH_SOCKET="$SSH_SOCKET_DIR/zhuyu-deploy-${SERVER_USER}@${SERVER_HOST}-${SERVER_SSH_PORT}.sock"

  SSH_COMMON_OPTS="-p $SERVER_SSH_PORT -o StrictHostKeyChecking=no -o ControlMaster=auto -o ControlPath=$SSH_SOCKET -o ControlPersist=60s"

  echo "📤 [2/3] 正在通过 rsync 增量同步部署包至远端服务器 (只需验证 1 次密码)..."
  ssh $SSH_COMMON_OPTS "$SERVER_USER@$SERVER_HOST" "mkdir -p $SERVER_DIR"

  rsync -avz --delete \
    -e "ssh $SSH_COMMON_OPTS" \
    --exclude '.git' \
    --exclude 'node_modules' \
    "$ROOT_DIR/dist" \
    "$ROOT_DIR/deploy" \
    "$SERVER_USER@$SERVER_HOST:$SERVER_DIR/"

  echo "🐳 [3/3] 正在远程执行 Docker Compose 拉起服务 (自动复用安全通道)..."
  ssh $SSH_COMMON_OPTS "$SERVER_USER@$SERVER_HOST" "cd $SERVER_DIR && docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build --remove-orphans"

  TARGET_IP="$SERVER_HOST"
else
  # 本机 Docker 运行模式
  echo "--------------------------------------------------"
  echo "📍 本地容器名称: $APP_NAME"
  echo "📍 本地访问端口: $APP_PORT"
  echo "--------------------------------------------------"

  echo "🐳 [2/2] 正在通过 Docker Compose 构建并启动容器..."
  docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build --remove-orphans

  TARGET_IP="localhost"
fi

echo "=================================================="
echo " 🎉 发版成功！听雨·禅意 3D 空间已正式运行。"
echo " 🌐 访问地址: http://${TARGET_IP}:${APP_PORT}"
echo "=================================================="
