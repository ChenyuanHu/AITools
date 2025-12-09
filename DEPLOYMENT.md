# 部署指南

## 前端部署

### 方式一：使用环境变量配置端口

1. **创建环境变量文件**（可选）：
   ```bash
   cd frontend
   cp .env.example .env
   ```

2. **修改 `.env` 文件**，设置端口：
   ```env
   PORT=3000
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

3. **启动服务**：
   ```bash
   # 开发模式
   npm run dev
   
   # 生产模式（需要先构建）
   npm run build
   npm run start
   ```

### 方式二：直接在命令行指定端口

```bash
# 开发模式，指定端口 3000
PORT=3000 npm run dev
# 或者
next dev -p 3000

# 生产模式，指定端口 3000
PORT=3000 npm run start
# 或者
next start -p 3000
```

### 方式三：修改 package.json 脚本

如果需要固定端口，可以修改 `frontend/package.json`：

```json
{
  "scripts": {
    "dev": "next dev -p 3000",
    "start": "next start -p 3000"
  }
}
```

## 后端部署

### 配置端口

1. **创建环境变量文件**：
   ```bash
   cd backend
   cp env.example .env
   ```

2. **修改 `.env` 文件**：
   ```env
   PORT=3001
   GOOGLE_AI_API_KEY=your_api_key_here
   JWT_SECRET=your_secret_key_here
   ```

3. **启动服务**：
   ```bash
   npm start
   # 或者使用 PM2
   pm2 start server.js --name ai-tools-backend
   ```

## 完整部署流程

### 1. 前端部署

```bash
cd frontend

# 安装依赖
npm install

# 构建生产版本
npm run build

# 启动服务（默认端口 3000，可通过 PORT 环境变量修改）
PORT=3000 npm run start

# 或者使用 PM2 管理进程
PORT=3000 pm2 start npm --name "ai-tools-frontend" -- start
```

### 2. 后端部署

```bash
cd backend

# 安装依赖
npm install

# 配置环境变量
cp env.example .env
# 编辑 .env 文件，填入必要的配置

# 启动服务（默认端口 3001，可通过 PORT 环境变量修改）
npm start

# 或者使用 PM2 管理进程
pm2 start server.js --name "ai-tools-backend"
```

### 3. 使用 PM2 管理（推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动前端（端口 3000）
cd frontend
PORT=3000 pm2 start npm --name "ai-tools-frontend" -- start

# 启动后端（端口 3001）
cd backend
PORT=3001 pm2 start server.js --name "ai-tools-backend"

# 查看状态
pm2 list

# 查看日志
pm2 logs

# 重启服务
pm2 restart ai-tools-frontend
pm2 restart ai-tools-backend

# 停止服务
pm2 stop ai-tools-frontend
pm2 stop ai-tools-backend

# 保存 PM2 配置
pm2 save
pm2 startup
```

### 4. 使用 Nginx 反向代理（可选）

如果需要使用 80/443 端口，可以配置 Nginx：

```nginx
# /etc/nginx/sites-available/ai-tools
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 环境变量说明

### 前端环境变量

- `PORT`: 前端服务端口（默认 3000）
- `NEXT_PUBLIC_API_URL`: 后端 API 地址（默认 http://localhost:3001）

### 后端环境变量

- `PORT`: 后端服务端口（默认 3001）
- `GOOGLE_AI_API_KEY`: Google AI API 密钥（必需）
- `JWT_SECRET`: JWT 密钥（用于用户认证）

## 注意事项

1. **生产环境**：确保修改 `JWT_SECRET` 为强密码
2. **API 地址**：如果前后端不在同一服务器，需要修改 `NEXT_PUBLIC_API_URL`
3. **防火墙**：确保开放相应端口（3000 和 3001）
4. **HTTPS**：生产环境建议使用 HTTPS，可以通过 Nginx 配置 SSL 证书

