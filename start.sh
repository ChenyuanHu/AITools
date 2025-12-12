#!/bin/bash

# AI Tools 启动脚本

echo "🚀 启动 AI Tools 服务..."

# 检查 .env 文件是否存在
if [ ! -f "./backend/.env" ]; then
    echo "❌ 错误: backend/.env 文件不存在"
    echo "请先创建 backend/.env 文件，参考 backend/env.example"
    exit 1
fi

# 创建日志目录（在项目根目录）
mkdir -p ./logs

# 启动后端服务
echo "📦 启动后端服务..."
cd backend
pm2 start server.js --name ai-tools-backend
cd ..

# 构建前端（如果还没有构建或需要重新构建）
if [ ! -d "./frontend/.next" ] || [ ! -f "./frontend/.next/BUILD_ID" ]; then
    echo "📦 构建前端应用..."
    cd frontend
    # 确保依赖已安装
    if [ ! -d "./node_modules" ]; then
        echo "📦 安装前端依赖..."
        npm install
    fi
    if ! npm run build; then
        echo "❌ 前端构建失败，请检查错误信息"
        exit 1
    fi
    cd ..
else
    echo "✅ 前端已构建，跳过构建步骤"
fi

# 启动前端服务
echo "📦 启动前端服务..."
# 确保 .next 目录存在
if [ ! -d "./frontend/.next" ]; then
    echo "❌ 错误: 前端未构建，请先运行构建命令"
    echo "   执行: cd frontend && npm run build"
    exit 1
fi
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

