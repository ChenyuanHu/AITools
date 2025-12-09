#!/bin/bash

# AI Tools 启动脚本

echo "🚀 启动 AI Tools 服务..."

# 检查 .env 文件是否存在
if [ ! -f "./backend/.env" ]; then
    echo "❌ 错误: backend/.env 文件不存在"
    echo "请先创建 backend/.env 文件，参考 backend/env.example"
    exit 1
fi

# 创建日志目录
mkdir -p logs

# 启动后端服务
echo "📦 启动后端服务..."
cd backend
pm2 start server.js --name ai-tools-backend
cd ..

# 构建前端（如果还没有构建）
if [ ! -d "./frontend/.next" ]; then
    echo "📦 构建前端应用..."
    cd frontend
    npm run build
    cd ..
fi

# 启动前端服务
echo "📦 启动前端服务..."
cd frontend
pm2 start npm --name ai-tools-frontend -- start
cd ..

# 显示状态
echo ""
echo "✅ 服务启动完成！"
echo ""
pm2 list
echo ""
echo "📝 常用命令："
echo "  查看日志: pm2 logs"
echo "  查看状态: pm2 list"
echo "  重启服务: pm2 restart all"
echo "  停止服务: pm2 stop all"
echo "  保存配置: pm2 save"

