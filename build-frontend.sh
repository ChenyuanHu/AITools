#!/bin/bash

# 前端构建脚本

echo "📦 开始构建前端应用..."

cd frontend

# 检查依赖是否已安装
if [ ! -d "./node_modules" ]; then
    echo "📦 安装前端依赖..."
    npm install
fi

# 构建应用
echo "🔨 构建 Next.js 应用..."
if npm run build; then
    echo "✅ 前端构建成功！"
    exit 0
else
    echo "❌ 前端构建失败，请检查错误信息"
    exit 1
fi

