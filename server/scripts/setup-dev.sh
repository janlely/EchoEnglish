#!/bin/bash

echo "🚀 EchoEnglish Server - 开发环境设置"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js 20+"
    exit 1
fi

echo "✅ Node.js 版本：$(node -v)"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装"
    exit 1
fi

echo "✅ npm 版本：$(npm -v)"

# 安装依赖
echo ""
echo "📦 安装依赖..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
fi

echo "✅ 依赖安装完成"

# 生成 Prisma Client
echo ""
echo "🔧 生成 Prisma Client..."
npm run db:generate

if [ $? -ne 0 ]; then
    echo "❌ Prisma Client 生成失败"
    exit 1
fi

echo "✅ Prisma Client 生成完成"

# 数据库迁移
echo ""
echo "🗄️  运行数据库迁移（SQLite）..."
npm run db:dev

if [ $? -ne 0 ]; then
    echo "❌ 数据库迁移失败"
    exit 1
fi

echo "✅ 数据库迁移完成"

# 播种数据
echo ""
echo "🌱 播种测试数据..."
npm run db:seed

if [ $? -ne 0 ]; then
    echo "⚠️  播种失败（可忽略）"
else
    echo "✅ 测试数据播种完成"
fi

echo ""
echo "======================================"
echo "✨ 设置完成！"
echo "======================================"
echo ""
echo "启动服务器："
echo "  npm run dev"
echo ""
echo "查看数据库："
echo "  npm run db:studio"
echo ""
echo "API 文档："
echo "  http://localhost:3000/api/health"
echo ""
