# Google AI Studio Web Console

这是一个复刻 Google AI Studio 的 Web 控制台，支持文本和图片的多模态输入输出，后端集成 Google AI Studio API。

## 功能特性

- ✅ 用户登录/注册系统
- ✅ 三栏布局界面（导航栏、主内容区、设置面板）
- ✅ 多模型选择（Gemini 系列）
- ✅ 文本和图片多模态输入
- ✅ 流式响应输出
- ✅ 可配置的模型参数（Temperature、Top P、系统指令等）
- ✅ 响应式设计

## 技术栈

### 前端
- Next.js 14 (React)
- TypeScript
- Tailwind CSS
- Axios
- React Dropzone (图片上传)

### 后端
- Node.js + Express
- Google Generative AI SDK
- JWT 认证
- Multer (文件上传)

## 快速开始

### 1. 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装所有依赖（前端+后端）
npm run install:all
```

### 2. 配置环境变量

在 `backend` 目录下创建 `.env` 文件：

```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件，填入你的配置：

```env
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
GOOGLE_AI_API_KEY=your-google-ai-api-key-here
```

**获取 Google AI API Key:**
1. 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 创建新的 API 密钥
3. 将密钥复制到 `.env` 文件中的 `GOOGLE_AI_API_KEY`

### 3. 启动开发服务器

```bash
# 同时启动前端和后端
npm run dev

# 或者分别启动
npm run dev:frontend  # 前端运行在 http://localhost:3000
npm run dev:backend   # 后端运行在 http://localhost:3001
```

### 4. 访问应用

打开浏览器访问 [http://localhost:3000](http://localhost:3000)

**默认测试账号:**
- 邮箱: `admin@example.com`
- 密码: `admin123`

## 项目结构

```
AITools/
├── frontend/              # Next.js 前端应用
│   ├── app/              # Next.js App Router
│   │   ├── login/        # 登录页面
│   │   ├── page.tsx      # 主页面
│   │   └── layout.tsx    # 布局组件
│   ├── components/       # React 组件
│   │   ├── Playground.tsx    # 主控制台组件
│   │   ├── Sidebar.tsx       # 侧边栏
│   │   ├── MainContent.tsx   # 主内容区
│   │   └── SettingsPanel.tsx # 设置面板
│   └── lib/              # 工具函数
│       └── api.ts        # API 客户端
├── backend/              # Express 后端
│   ├── server.js         # 服务器入口
│   ├── uploads/          # 上传文件目录（自动创建）
│   └── .env             # 环境变量配置
└── README.md
```

## API 端点

### 认证
- `POST /api/auth/register` - 注册新用户
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息

### 模型
- `GET /api/models` - 获取可用模型列表

### 生成
- `POST /api/generate` - 生成内容（一次性返回）
- `POST /api/generate/stream` - 流式生成内容（SSE）

## 使用说明

1. **登录/注册**: 首次使用需要注册账号或使用默认测试账号登录
2. **选择模型**: 在主内容区选择要使用的 AI 模型
3. **输入提示词**: 在底部输入框输入你的提示词
4. **上传图片** (可选): 
   - 点击"上传图片"按钮
   - 或直接拖拽图片到输入区域
5. **配置参数**: 在右侧设置面板调整模型参数
6. **生成内容**: 点击"发送"按钮或使用 `Cmd/Ctrl + Enter` 快捷键

## 注意事项

- 确保已配置有效的 Google AI API Key
- 图片文件大小限制为 10MB
- 支持的图片格式: JPEG, JPG, PNG, GIF, WEBP
- 生产环境请修改默认的 JWT_SECRET
- 当前用户数据存储在内存中，重启服务器会丢失（生产环境应使用数据库）

## 开发

### 添加新功能

1. 前端组件: 在 `frontend/components/` 目录下创建新组件
2. API 端点: 在 `backend/server.js` 中添加新路由
3. API 客户端: 在 `frontend/lib/api.ts` 中添加新的 API 调用函数

### 代码风格

- 使用 TypeScript 进行类型检查
- 遵循 ESLint 规则
- 使用 Prettier 格式化代码

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

