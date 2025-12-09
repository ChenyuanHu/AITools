# CORS 错误修复指南

## 问题描述

部署到云端后出现 CORS 错误，导致登录失败。

## 常见原因

1. **前端 API URL 配置错误**：前端仍然指向 `localhost:3001`
2. **后端 CORS 配置不完整**：需要允许前端的域名
3. **前后端不在同一域名**：需要正确配置 CORS

## 解决步骤

### 1. 检查前端 API URL 配置

**问题：** 前端可能仍然使用 `http://localhost:3001`

**解决方法：**

#### 方式一：使用环境变量（推荐）

在部署服务器上，设置环境变量：

```bash
# 如果前后端在同一服务器
export NEXT_PUBLIC_API_URL=http://your-server-ip:3001

# 如果使用域名
export NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# 或者创建 frontend/.env.local 文件
cd frontend
echo "NEXT_PUBLIC_API_URL=http://your-server-ip:3001" > .env.local
```

**重要：** 如果修改了环境变量，需要重新构建前端：
```bash
cd frontend
npm run build
```

#### 方式二：修改 next.config.js

```javascript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://your-server-ip:3001';

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: API_URL,
  },
}
```

### 2. 检查后端 CORS 配置

后端已经配置了 CORS，但如果你需要限制特定域名：

**编辑 `backend/.env`：**
```env
ALLOWED_ORIGINS=http://your-frontend-domain:3000,https://your-frontend-domain.com
```

**或者修改 `backend/server.js` 中的 CORS 配置：**

```javascript
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['*']; // 允许所有来源
    
    if (allowedOrigins.includes('*') || !origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
```

### 3. 检查网络连接

确保：
- 后端服务正在运行：`pm2 list` 或 `curl http://your-server-ip:3001/api/models`
- 防火墙允许相应端口（3000 和 3001）
- 如果使用云服务，检查安全组设置

### 4. 完整部署检查清单

```bash
# 1. 检查后端是否运行
pm2 list
curl http://localhost:3001/api/models

# 2. 检查前端环境变量
cd frontend
cat .env.local  # 或检查环境变量

# 3. 重新构建前端（如果修改了环境变量）
npm run build

# 4. 重启服务
pm2 restart all

# 5. 检查浏览器控制台
# 打开浏览器开发者工具，查看 Network 标签页
```

## 调试技巧

### 查看实际请求的 URL

在浏览器开发者工具的 Network 标签页中：
1. 找到失败的请求
2. 查看 Request URL
3. 确认是否指向正确的后端地址

### 测试后端 API

```bash
# 测试后端是否可访问
curl http://your-server-ip:3001/api/models

# 测试登录接口
curl -X POST http://your-server-ip:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"name":"your-username","password":"your-password"}'
```

### 查看后端日志

```bash
# PM2 日志
pm2 logs ai-tools-backend

# 或直接查看日志文件
tail -f logs/backend-out.log
tail -f logs/backend-error.log
```

## 常见配置示例

### 场景 1：前后端在同一服务器

**前端 `.env.local`：**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**后端 `.env`：**
```env
PORT=3001
# 不需要设置 ALLOWED_ORIGINS，默认允许所有
```

### 场景 2：前后端在不同服务器

**前端 `.env.local`：**
```env
NEXT_PUBLIC_API_URL=http://backend-server-ip:3001
```

**后端 `.env`：**
```env
PORT=3001
ALLOWED_ORIGINS=http://frontend-server-ip:3000,https://yourdomain.com
```

### 场景 3：使用域名和 HTTPS

**前端 `.env.local`：**
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

**后端 `.env`：**
```env
PORT=3001
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

## 如果问题仍然存在

1. **检查浏览器控制台**：查看具体的 CORS 错误信息
2. **检查后端日志**：查看是否有请求到达后端
3. **测试后端 API**：使用 curl 或 Postman 直接测试后端接口
4. **检查防火墙**：确保端口已开放
5. **检查 Nginx 配置**（如果使用）：确保代理配置正确

