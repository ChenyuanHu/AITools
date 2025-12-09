#!/bin/bash

# AI Tools 停止脚本

echo "🛑 停止 AI Tools 服务..."

pm2 stop ai-tools-backend
pm2 stop ai-tools-frontend

echo "✅ 服务已停止"
pm2 list

