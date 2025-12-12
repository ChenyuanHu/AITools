import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// 检查必需的环境变量
const requiredEnvVars = {
  PORT: process.env.PORT,
  JWT_SECRET: process.env.JWT_SECRET,
  DEFAULT_USER_NAME: process.env.DEFAULT_USER_NAME,
  DEFAULT_USER_PASSWORD: process.env.DEFAULT_USER_PASSWORD,
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('❌ 错误: 缺少必需的环境变量:');
  missingVars.forEach(key => {
    console.error(`   - ${key}`);
  });
  console.error('\n请创建 .env 文件并配置这些变量。参考 env.example 文件。');
  process.exit(1);
}

const app = express();
const PORT = parseInt(process.env.PORT, 10);
const JWT_SECRET = process.env.JWT_SECRET;

// CORS 配置
const corsOptions = {
  origin: function (origin, callback) {
    // 允许所有来源（生产环境建议限制特定域名）
    // 如果需要限制，可以这样配置：
    // const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'];
    // if (!origin || allowedOrigins.indexOf(origin) !== -1) {
    //   callback(null, true);
    // } else {
    //   callback(new Error('Not allowed by CORS'));
    // }
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// 内存存储用户（生产环境应使用数据库）
// 从环境变量读取默认用户信息
const defaultUserName = process.env.DEFAULT_USER_NAME;
const defaultUserPassword = process.env.DEFAULT_USER_PASSWORD;

const users = [
  {
    id: 1,
    password: bcrypt.hashSync(defaultUserPassword, 10),
    name: defaultUserName
  }
];

// 中间件
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static('uploads'));

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('只支持图片文件 (jpeg, jpg, png, gif, webp)'));
  }
});

// 初始化Google AI
let genAI = null;
if (process.env.GOOGLE_AI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
}

// 模型名称映射：前端使用的ID -> Google AI API实际使用的模型名称
const modelNameMap = {
  'gemini-3-pro-preview': 'gemini-3-pro-preview',
  'gemini-3-pro-image-preview': 'gemini-3-pro-image-preview',
  'gemini-2.5-flash': 'gemini-2.5-flash',
  'gemini-2.5-flash-image': 'gemini-2.5-flash-image' // 使用 latest 版本
};

// 防暴力破解：记录失败的登录尝试
const failedLoginAttempts = [];
const MAX_ATTEMPTS = 5; // 最大尝试次数
const WINDOW_MS = 10 * 60 * 1000; // 10分钟（毫秒）

// 清理过期的失败尝试记录
const cleanExpiredAttempts = () => {
  const now = Date.now();
  const validAttempts = failedLoginAttempts.filter(attempt => now - attempt.timestamp < WINDOW_MS);
  failedLoginAttempts.length = 0;
  failedLoginAttempts.push(...validAttempts);
};

// 检查是否超过速率限制
const checkRateLimit = () => {
  cleanExpiredAttempts();
  return failedLoginAttempts.length >= MAX_ATTEMPTS;
};

// 记录失败的登录尝试
const recordFailedAttempt = () => {
  failedLoginAttempts.push({
    timestamp: Date.now(),
    ip: 'global' // 全局限制，不区分IP
  });
};

// 清除失败尝试记录（登录成功时调用）
const clearFailedAttempts = () => {
  failedLoginAttempts.length = 0;
};

// 认证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未授权，请先登录' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '令牌无效' });
    }
    req.user = user;
    next();
  });
};

// 路由

// 登录
app.post('/api/auth/login', async (req, res) => {
  try {
    // 检查速率限制
    if (checkRateLimit()) {
      const oldestAttempt = failedLoginAttempts[0];
      const remainingTime = Math.ceil((WINDOW_MS - (Date.now() - oldestAttempt.timestamp)) / 1000 / 60);
      return res.status(429).json({ 
        error: `登录尝试次数过多，请 ${remainingTime} 分钟后再试`,
        retryAfter: Math.ceil((WINDOW_MS - (Date.now() - oldestAttempt.timestamp)) / 1000)
      });
    }

    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({ error: '姓名和密码是必填项' });
    }

    const user = users.find(u => u.name === name);
    if (!user) {
      recordFailedAttempt();
      return res.status(401).json({ error: '姓名或密码错误' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      recordFailedAttempt();
      return res.status(401).json({ error: '姓名或密码错误' });
    }

    // 登录成功，清除失败尝试记录
    clearFailedAttempts();

    const token = jwt.sign(
      { id: user.id, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name
      }
    });
  } catch (error) {
    res.status(500).json({ error: '登录失败' });
  }
});

// 获取当前用户
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  res.json({
    id: user.id,
    name: user.name
  });
});

// 获取可用模型列表
app.get('/api/models', authenticateToken, (req, res) => {
  const models = [
    {
      id: 'gemini-3-pro-preview',
      name: 'Gemini 3 Pro Preview',
      description: '我们最智能的模型，具有SOTA推理和多模态理解能力，以及强大的代理和编码能力',
      type: 'gemini',
      isNew: true
    },
    {
      id: 'gemini-3-pro-image-preview',
      name: '【图像】Gemini 3 Pro Image Preview',
      description: '我们最智能的模型，具有SOTA推理和多模态理解能力，以及强大的代理和编码能力',
      type: 'gemini',
      isNew: true
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      description: '强大的多模态模型，支持长上下文',
      type: 'gemini',
      isNew: false
    },
    {
      id: 'gemini-2.5-flash-image',
      name: '【图像】Gemini 2.5 Flash Image',
      description: '快速且高效的多模态模型',
      type: 'gemini',
      isNew: false
    }
  ];
  res.json(models);
});

// 生成内容（支持文本和图片）
app.post('/api/generate', authenticateToken, upload.array('images', 5), async (req, res) => {
  try {
    if (!genAI) {
      return res.status(500).json({ error: 'Google AI API密钥未配置' });
    }

    // 解析历史消息
    let history = [];
    try {
      if (req.body.history) {
        history = typeof req.body.history === 'string' 
          ? JSON.parse(req.body.history) 
          : req.body.history;
      }
    } catch (e) {
      console.error('[生成] 解析历史消息失败:', e);
    }

    const { prompt, modelId = 'gemini-3-pro-preview', temperature = 1, systemInstruction } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: '提示词不能为空' });
    }

    // 映射模型ID到实际的模型名称
    const actualModelName = modelNameMap[modelId] || modelId;
    console.log(`[生成] 使用模型: ${modelId} -> ${actualModelName}, 历史消息数: ${history.length}`);
    
    let model;
    try {
      model = genAI.getGenerativeModel({ 
        model: actualModelName,
        systemInstruction: systemInstruction || undefined
      });
    } catch (error) {
      console.error(`[生成] 模型初始化错误:`, error);
      // 如果模型名称失败，尝试使用原始ID
      if (actualModelName !== modelId) {
        console.log(`[生成] 尝试使用原始模型ID: ${modelId}`);
        model = genAI.getGenerativeModel({ 
          model: modelId,
          systemInstruction: systemInstruction || undefined
        });
      } else {
        throw error;
      }
    }

    // 构建历史对话内容
    const contents = [];
    
    // 转换历史消息为 Google AI API 格式
    for (const msg of history) {
      const parts = [];
      
      // 添加文本内容
      if (msg.content) {
        parts.push({ text: msg.content });
      }
      
      // 添加图片内容
      if (msg.images && msg.images.length > 0) {
        for (const img of msg.images) {
          parts.push({
            inlineData: {
              data: img.data,
              mimeType: img.mimeType
            }
          });
        }
      }
      
      if (parts.length > 0) {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: parts
        });
      }
    }

    // 构建当前请求内容
    const currentParts = [{ text: prompt }];

    // 如果有图片，添加图片到parts
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const imageData = fs.readFileSync(file.path);
        const base64Image = imageData.toString('base64');
        currentParts.push({
          inlineData: {
            data: base64Image,
            mimeType: file.mimetype
          }
        });
      }
    }

    // 添加当前用户消息到对话历史
    contents.push({
      role: 'user',
      parts: currentParts
    });

    // 检查是否是图片生成模型
    const isImageModel = modelId.includes('image') || modelId === 'gemini-2.5-flash-image';
    
    // 生成内容（包含完整对话历史）
    const result = await model.generateContent({
      contents: contents,
      generationConfig: {
        temperature: parseFloat(temperature),
        topP: 0.95,
        maxOutputTokens: 65536,
        ...(isImageModel && { responseModalities: ['TEXT', 'IMAGE'] }) // 图片生成模型同时支持文本和图片
      }
    });

    const response = await result.response;
    
    // 调试：打印完整响应结构（仅图片模型）
    if (isImageModel) {
      console.log('[生成] 完整响应结构:', JSON.stringify(response, null, 2));
    }
    
    // 检查是否有图片数据
    let images = [];
    if (response.candidates && response.candidates.length > 0) {
      const content = response.candidates[0].content;
      if (content && content.parts) {
        for (const part of content.parts) {
          if (part.inlineData) {
            console.log('[生成] 找到图片数据');
            images.push({
              data: part.inlineData.data,
              mimeType: part.inlineData.mimeType
            });
          }
        }
      }
    }
    
    let text = '';
    try {
      text = response.text();
    } catch (e) {
      // 如果只有图片没有文本，text() 可能抛出错误
      console.log('[生成] 无法获取文本，可能只有图片');
    }

    // 清理上传的文件
    if (req.files) {
      req.files.forEach(file => {
        fs.unlinkSync(file.path);
      });
    }

    res.json({
      text,
      images: images.length > 0 ? images : undefined,
      model: modelId,
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.usageMetadata?.completionTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0
      }
    });
  } catch (error) {
    console.error('生成内容错误:', error);
    
    // 清理上传的文件
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    res.status(500).json({ 
      error: '生成内容失败',
      message: error.message 
    });
  }
});

// 流式生成内容
app.post('/api/generate/stream', authenticateToken, upload.array('images', 5), async (req, res) => {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // 处理multer文件上传错误
  if (req.fileValidationError) {
    console.error(`[流式生成][${requestId}] ❌ 文件验证错误: ${req.fileValidationError}`);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.write(`data: ${JSON.stringify({ 
      error: 'FileValidationError',
      message: req.fileValidationError
    })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    return;
  }
  console.log(`[流式生成][${requestId}] ========== 请求开始 ==========`);
  console.log(`[流式生成][${requestId}] 客户端IP: ${req.ip || req.connection.remoteAddress}`);
  console.log(`[流式生成][${requestId}] 请求头:`, JSON.stringify({
    'content-type': req.headers['content-type'],
    'authorization': req.headers['authorization'] ? '已设置' : '未设置',
    'content-length': req.headers['content-length']
  }));
  
  try {
    if (!genAI) {
      console.error(`[流式生成][${requestId}] ❌ Google AI API密钥未配置`);
      return res.status(500).json({ error: 'Google AI API密钥未配置' });
    }
    console.log(`[流式生成][${requestId}] ✅ Google AI 客户端已初始化`);

    // 解析历史消息
    let history = [];
    try {
      if (req.body.history) {
        history = typeof req.body.history === 'string' 
          ? JSON.parse(req.body.history) 
          : req.body.history;
        console.log(`[流式生成][${requestId}] 📝 历史消息解析成功，数量: ${history.length}`);
      } else {
        console.log(`[流式生成][${requestId}] 📝 无历史消息`);
      }
    } catch (e) {
      console.error(`[流式生成][${requestId}] ❌ 解析历史消息失败:`, e);
    }

    const { 
      prompt, 
      modelId = 'gemini-3-pro-preview', 
      temperature = 1, 
      systemInstruction, 
      thinkingBudget, 
      includeThoughts, 
      thinkingLevel,
      aspectRatio,
      imageSize,
      responseModalities
    } = req.body;
    console.log(`[流式生成][${requestId}] 📋 请求参数:`, {
      modelId,
      temperature,
      promptLength: prompt?.length || 0,
      hasSystemInstruction: !!systemInstruction,
      hasImages: !!(req.files && req.files.length > 0),
      imageCount: req.files?.length || 0,
      thinkingBudget: thinkingBudget !== undefined ? thinkingBudget : '未设置',
      includeThoughts: includeThoughts !== undefined ? includeThoughts : '未设置'
    });

    if (!prompt) {
      console.error(`[流式生成][${requestId}] ❌ 提示词为空`);
      return res.status(400).json({ error: '提示词不能为空' });
    }

    // 映射模型ID到实际的模型名称
    const actualModelName = modelNameMap[modelId] || modelId;
    console.log(`[流式生成][${requestId}] 🤖 使用模型: ${modelId} -> ${actualModelName}, 历史消息数: ${history.length}`);
    
    let model;
    try {
      console.log(`[流式生成][${requestId}] 🔧 开始初始化模型...`);
      model = genAI.getGenerativeModel({ 
        model: actualModelName,
        systemInstruction: systemInstruction || undefined
      });
      console.log(`[流式生成][${requestId}] ✅ 模型初始化成功: ${actualModelName}`);
    } catch (error) {
      console.error(`[流式生成][${requestId}] ❌ 模型初始化错误:`, error);
      console.error(`[流式生成][${requestId}] ❌ 错误堆栈:`, error.stack);
      // 如果模型名称失败，尝试使用原始ID
      if (actualModelName !== modelId) {
        console.log(`[流式生成][${requestId}] 🔄 尝试使用原始模型ID: ${modelId}`);
        try {
          model = genAI.getGenerativeModel({ 
            model: modelId,
            systemInstruction: systemInstruction || undefined
          });
          console.log(`[流式生成][${requestId}] ✅ 使用原始模型ID成功: ${modelId}`);
        } catch (retryError) {
          console.error(`[流式生成][${requestId}] ❌ 重试失败:`, retryError);
          throw retryError;
        }
      } else {
        throw error;
      }
    }

    // 构建历史对话内容
    const contents = [];
    console.log(`[流式生成][${requestId}] 📚 开始构建对话内容...`);
    
    // 转换历史消息为 Google AI API 格式
    for (let i = 0; i < history.length; i++) {
      const msg = history[i];
      const parts = [];
      
      // 添加文本内容
      if (msg.content) {
        parts.push({ text: msg.content });
        console.log(`[流式生成][${requestId}] 📝 历史消息[${i}]: ${msg.role}, 文本长度: ${msg.content.length}`);
      }
      
      // 添加图片内容
      if (msg.images && msg.images.length > 0) {
        for (const img of msg.images) {
          parts.push({
            inlineData: {
              data: img.data,
              mimeType: img.mimeType
            }
          });
          console.log(`[流式生成][${requestId}] 🖼️  历史消息[${i}]: 包含图片, MIME: ${img.mimeType}`);
        }
      }
      
      if (parts.length > 0) {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: parts
        });
      }
    }

    // 构建当前请求内容
    const currentParts = [{ text: prompt }];
    console.log(`[流式生成][${requestId}] 📝 当前提示词长度: ${prompt.length}`);

    // 如果有图片，添加图片到parts
    if (req.files && req.files.length > 0) {
      console.log(`[流式生成][${requestId}] 🖼️  开始处理 ${req.files.length} 张图片...`);
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        try {
          console.log(`[流式生成][${requestId}] 🖼️  处理图片[${i}]: ${file.originalname}, 大小: ${file.size} bytes, MIME: ${file.mimetype}`);
          const imageData = fs.readFileSync(file.path);
          const base64Image = imageData.toString('base64');
          currentParts.push({
            inlineData: {
              data: base64Image,
              mimeType: file.mimetype
            }
          });
          console.log(`[流式生成][${requestId}] ✅ 图片[${i}]处理完成, Base64长度: ${base64Image.length}`);
        } catch (fileError) {
          console.error(`[流式生成][${requestId}] ❌ 处理图片[${i}]失败:`, fileError);
        }
      }
    }

    // 添加当前用户消息到对话历史
    contents.push({
      role: 'user',
      parts: currentParts
    });
    console.log(`[流式生成][${requestId}] ✅ 对话内容构建完成, 总消息数: ${contents.length}, 当前消息parts数: ${currentParts.length}`);

    // 设置SSE响应头
    console.log(`[流式生成][${requestId}] 📡 设置SSE响应头...`);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    console.log(`[流式生成][${requestId}] ✅ SSE响应头已设置`);

    // 标记响应头已设置，用于错误处理
    let sseHeadersSet = true;

    // 检查是否是图片生成模型
    const isImageModel = modelId.includes('image') || modelId === 'gemini-2.5-flash-image';
    console.log(`[流式生成][${requestId}] 🎨 是否为图片生成模型: ${isImageModel}`);
    
    // 准备生成配置
    let generationConfig = {
      temperature: parseFloat(temperature),
      topP: 0.95,
      maxOutputTokens: 65536,
    };
    
    // 图片生成配置
    if (isImageModel) {
      // Response Modalities
      let modalities = ['TEXT', 'IMAGE']; // 默认值
      if (responseModalities) {
        try {
          modalities = typeof responseModalities === 'string' 
            ? JSON.parse(responseModalities) 
            : responseModalities;
        } catch (e) {
          console.log(`[流式生成][${requestId}] ⚠️  解析responseModalities失败，使用默认值`);
        }
      }
      generationConfig.responseModalities = modalities;
      
      // Image Config
      const imageConfig = {};
      if (aspectRatio) {
        imageConfig.aspectRatio = aspectRatio;
        console.log(`[流式生成][${requestId}] 🖼️  设置宽高比: ${aspectRatio}`);
      }
      if (imageSize && modelId === 'gemini-3-pro-image-preview') {
        imageConfig.imageSize = imageSize;
        console.log(`[流式生成][${requestId}] 🖼️  设置图片分辨率: ${imageSize}`);
      }
      
      if (Object.keys(imageConfig).length > 0) {
        generationConfig.imageConfig = imageConfig;
      }
    }
    
    // 准备thinking配置（根据Gemini文档）
    // Gemini 3 Pro使用thinkingLevel ("low" 或 "high")
    // Gemini 2.5系列使用thinkingBudget
    // ⚠️ 重要：根据文档，只有 gemini-3-pro-image-preview 支持 thinking
    // gemini-2.5-flash-image 不支持 thinking
    const isGemini3 = modelId.includes('gemini-3') || modelId.includes('3-pro');
    const shouldIncludeThoughts = includeThoughts === 'true' || includeThoughts === true || includeThoughts === '1';
    
    // 检查模型是否支持 thinking
    // 根据文档：只有 gemini-3-pro-image-preview 支持 thinking，gemini-2.5-flash-image 不支持
    const supportsThinking = !isImageModel || modelId === 'gemini-3-pro-image-preview';
    
    let thinkingConfig = null;
    if (shouldIncludeThoughts && supportsThinking) {
      if (isGemini3) {
        // Gemini 3 Pro Image Preview: thinking默认启用，不支持thinkingLevel参数
        // 根据文档：The Gemini 3 Pro Image Preview model is a thinking model and uses a reasoning process ("Thinking") for complex prompts. This feature is enabled by default and cannot be disabled in the API.
        if (modelId === 'gemini-3-pro-image-preview') {
          // Gemini 3 Pro Image Preview 只使用 includeThoughts，不使用 thinkingLevel
          thinkingConfig = {
            includeThoughts: true
          };
          console.log(`[流式生成][${requestId}] 💭 配置thinking (Gemini 3 Pro Image): includeThoughts=true (thinking默认启用，不支持thinkingLevel)`);
        } else {
          // 其他 Gemini 3 Pro 模型使用 thinkingLevel
          const level = thinkingLevel || 'high'; // 默认high
          thinkingConfig = {
            thinkingLevel: level,
            includeThoughts: true
          };
          console.log(`[流式生成][${requestId}] 💭 配置thinking (Gemini 3 Pro): thinkingLevel=${level}, includeThoughts=true`);
        }
      } else {
        // Gemini 2.5系列使用thinkingBudget（仅非图片模型）
        const budget = thinkingBudget !== undefined ? parseInt(thinkingBudget) : -1; // -1表示动态thinking
        thinkingConfig = {
          thinkingBudget: budget,
          includeThoughts: true
        };
        console.log(`[流式生成][${requestId}] 💭 配置thinking (Gemini 2.5): thinkingBudget=${budget}, includeThoughts=true`);
      }
    } else {
      if (shouldIncludeThoughts && !supportsThinking) {
        console.log(`[流式生成][${requestId}] ⚠️  模型 ${modelId} 不支持 thinking，已忽略 thinkingConfig`);
      } else {
        console.log(`[流式生成][${requestId}] ⚡ thinking未启用 (includeThoughts=false或未设置)`);
      }
    }
    
    // 构建请求配置
    const requestConfig = {
      generationConfig: generationConfig
    };
    
    // 如果配置了thinking，添加到请求中
    // 注意：根据文档，thinkingConfig应该在generationConfig中，但实际可能需要不同的位置
    // 先尝试放在generationConfig中
    if (thinkingConfig) {
      requestConfig.generationConfig = {
        ...generationConfig,
        thinkingConfig: thinkingConfig
      };
    }
    
    console.log(`[流式生成][${requestId}] ⚙️  生成配置:`, JSON.stringify(requestConfig.generationConfig));
    console.log(`[流式生成][${requestId}] 📤 准备调用 Gemini API generateContentStream...`);
    console.log(`[流式生成][${requestId}] 📤 请求内容摘要:`, {
      contentsCount: contents.length,
      lastMessagePartsCount: contents[contents.length - 1]?.parts?.length || 0,
      hasThinkingConfig: !!thinkingConfig
    });
    
    // ⚠️ 重要：在API调用之前就启动心跳机制，因为generateContentStream调用本身可能会阻塞很长时间
    // 启动心跳机制：在等待第一个chunk时定期发送心跳，避免连接超时
    console.log(`[流式生成][${requestId}] 💓 启动心跳机制（每5秒）...`);
    const heartbeatInterval = setInterval(() => {
      if (!res.closed && !res.destroyed) {
        try {
          const heartbeatTime = Date.now();
          res.write(`: heartbeat ${heartbeatTime}\n\n`); // SSE注释格式，客户端会忽略，但可以用于调试
          console.log(`[流式生成][${requestId}] 💓 发送心跳: ${heartbeatTime}`);
        } catch (e) {
          // 忽略心跳发送错误
          console.log(`[流式生成][${requestId}] ⚠️  心跳发送失败:`, e.message);
        }
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 5000); // 每5秒发送一次心跳（更频繁，确保连接保持活跃）
    
    // 标记是否已收到第一个chunk
    let firstChunkReceived = false;
    
    // 生成流式内容（包含完整对话历史）
    const apiCallStartTime = Date.now();
    let result;
    try {
      console.log(`[流式生成][${requestId}] ⏳ 开始调用 Gemini API（可能耗时较长）...`);
      // 根据文档，thinkingConfig应该在generationConfig中
      result = await model.generateContentStream({
        contents: contents,
        ...requestConfig
      });
      const apiCallDuration = Date.now() - apiCallStartTime;
      console.log(`[流式生成][${requestId}] ✅ Gemini API调用成功, 耗时: ${apiCallDuration}ms`);
      console.log(`[流式生成][${requestId}] 📥 开始接收流式响应...`);
    } catch (apiError) {
      clearInterval(heartbeatInterval); // 确保清理心跳
      const apiCallDuration = Date.now() - apiCallStartTime;
      console.error(`[流式生成][${requestId}] ❌ Gemini API调用失败, 耗时: ${apiCallDuration}ms`);
      console.error(`[流式生成][${requestId}] ❌ API错误详情:`, apiError);
      console.error(`[流式生成][${requestId}] ❌ API错误堆栈:`, apiError.stack);
      throw apiError;
    }

    // 收集所有图片数据，在流结束时一次性发送
    let collectedImages = [];
    let chunkCount = 0;
    let textChunkCount = 0;
    let thinkingChunkCount = 0;
    let imageChunkCount = 0;
    const streamStartTime = Date.now();
    
    try {
      console.log(`[流式生成][${requestId}] 🔄 开始遍历流式响应...`);
      for await (const chunk of result.stream) {
        chunkCount++;
        
        // 收到第一个chunk，停止心跳
        if (!firstChunkReceived) {
          firstChunkReceived = true;
          clearInterval(heartbeatInterval);
          const firstChunkTime = Date.now() - apiCallStartTime;
          console.log(`[流式生成][${requestId}] 🎉 收到第一个chunk, 等待时间: ${firstChunkTime}ms`);
        }
        
        // 检查客户端是否断开连接
        if (res.closed || res.destroyed) {
          console.log(`[流式生成][${requestId}] ⚠️  客户端断开连接 (chunk ${chunkCount})`);
          clearInterval(heartbeatInterval);
          break;
        }

        // 详细记录chunk结构（前几个chunk）
        if (chunkCount <= 3) {
          console.log(`[流式生成][${requestId}] 🔍 chunk[${chunkCount}] 结构:`, {
            hasCandidates: !!chunk.candidates,
            candidatesLength: chunk.candidates?.length || 0,
            hasPromptFeedback: !!chunk.promptFeedback,
            chunkKeys: Object.keys(chunk)
          });
          if (chunk.candidates && chunk.candidates.length > 0) {
            const candidate = chunk.candidates[0];
            console.log(`[流式生成][${requestId}] 🔍 chunk[${chunkCount}] candidate结构:`, {
              hasContent: !!candidate.content,
              hasParts: !!(candidate.content?.parts),
              partsLength: candidate.content?.parts?.length || 0,
              finishReason: candidate.finishReason,
              candidateKeys: Object.keys(candidate)
            });
            if (candidate.content?.parts) {
              candidate.content.parts.forEach((part, idx) => {
                console.log(`[流式生成][${requestId}] 🔍 chunk[${chunkCount}] part[${idx}]:`, {
                  hasText: !!part.text,
                  hasThought: !!part.thought,
                  hasInlineData: !!part.inlineData,
                  partKeys: Object.keys(part)
                });
              });
            }
          }
        }

        // 检查是否有thinking内容和文本内容
        // 重要：需要先检查parts，区分thinking和普通文本，避免重复发送
        let hasThinking = false;
        let thinkingText = '';
        let regularText = '';
        
        try {
          const candidates = chunk.candidates;
          if (candidates && candidates.length > 0) {
            const content = candidates[0].content;
            if (content && content.parts) {
              // 遍历所有parts，区分thinking和普通文本
              for (const part of content.parts) {
                if (part.thought === true && part.text) {
                  // 这是thinking内容
                  hasThinking = true;
                  thinkingText += part.text;
                } else if (part.text && part.thought !== true) {
                  // 这是普通文本内容（明确不是thinking）
                  regularText += part.text;
                }
              }
            }
          }
        } catch (e) {
          // 忽略检查错误
          if (chunkCount <= 5) {
            console.log(`[流式生成][${requestId}] ⚠️  检查parts时出错 (chunk ${chunkCount}):`, e.message);
          }
        }

        // 发送thinking内容
        if (hasThinking && thinkingText) {
          thinkingChunkCount++;
          if (thinkingChunkCount <= 3 || thinkingChunkCount % 10 === 0) {
            console.log(`[流式生成][${requestId}] 💭 收到thinking chunk[${thinkingChunkCount}], 长度: ${thinkingText.length}, 预览: ${thinkingText.substring(0, 50)}...`);
          }
          try {
            res.write(`data: ${JSON.stringify({ thinking: thinkingText })}\n\n`);
          } catch (writeError) {
            console.error(`[流式生成][${requestId}] ❌ 写入thinking失败:`, writeError);
          }
        }

        // 发送普通文本内容（不包括thinking）
        if (regularText) {
          textChunkCount++;
          if (textChunkCount <= 3 || textChunkCount % 10 === 0) {
            console.log(`[流式生成][${requestId}] 📝 收到文本chunk[${textChunkCount}], 长度: ${regularText.length}, 内容预览: ${regularText.substring(0, 50)}...`);
          }
          try {
            res.write(`data: ${JSON.stringify({ text: regularText })}\n\n`);
          } catch (writeError) {
            console.error(`[流式生成][${requestId}] ❌ 写入文本chunk失败:`, writeError);
            console.error(`[流式生成][${requestId}] ❌ 写入错误详情:`, {
              message: writeError.message,
              code: writeError.code,
              closed: res.closed,
              destroyed: res.destroyed
            });
            throw writeError;
          }
        }
        
        // 收集图片数据（区分thinking过程中的临时图片和最终图片）
        // 根据文档：Gemini 3 Pro Image Preview 在thinking过程中会生成临时图片，只有最后一个才是最终图片
        try {
          const candidates = chunk.candidates;
          if (candidates && candidates.length > 0) {
            const content = candidates[0].content;
            if (content && content.parts) {
              for (const part of content.parts) {
                if (part.inlineData) {
                  if (part.thought === true) {
                    // 这是thinking过程中的图片（临时图片）
                    // 根据文档：The last image within Thinking is also the final rendered image.
                    // 我们只保留最后一个thinking图片作为最终图片
                    imageChunkCount++;
                    console.log(`[流式生成][${requestId}] 🖼️  收集到thinking过程中的图片[${imageChunkCount}], MIME类型: ${part.inlineData.mimeType}, 数据长度: ${part.inlineData.data?.length || 0}`);
                    // 清空之前的thinking图片，只保留最后一个
                    collectedImages = collectedImages.filter(img => !img.isThinkingImage);
                    collectedImages.push({
                      data: part.inlineData.data,
                      mimeType: part.inlineData.mimeType,
                      isThinkingImage: true // 标记为thinking图片
                    });
                  } else {
                    // 这是非thinking的图片（最终图片）
                    imageChunkCount++;
                    console.log(`[流式生成][${requestId}] 🖼️  收集到最终图片[${imageChunkCount}], MIME类型: ${part.inlineData.mimeType}, 数据长度: ${part.inlineData.data?.length || 0}`);
                    collectedImages.push({
                      data: part.inlineData.data,
                      mimeType: part.inlineData.mimeType,
                      isThinkingImage: false
                    });
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error(`[流式生成][${requestId}] ❌ 收集图片数据时出错 (chunk ${chunkCount}):`, e);
        }
      }
      
      // 确保停止心跳
      clearInterval(heartbeatInterval);
      
      const streamDuration = Date.now() - streamStartTime;
      console.log(`[流式生成][${requestId}] ✅ 流式响应接收完成`);
      console.log(`[流式生成][${requestId}] 📊 流处理统计:`, {
        总chunk数: chunkCount,
        文本chunk数: textChunkCount,
        thinkingChunk数: thinkingChunkCount,
        图片chunk数: imageChunkCount,
        收集的图片数: collectedImages.length,
        耗时: `${streamDuration}ms`,
        第一个chunk等待时间: firstChunkReceived ? `${Date.now() - apiCallStartTime - streamDuration}ms` : '未收到'
      });
      
      // 流结束后，一次性发送所有图片
      // 优先发送非thinking的图片，如果没有则发送最后一个thinking图片
      const finalImages = collectedImages.filter(img => !img.isThinkingImage);
      const thinkingImages = collectedImages.filter(img => img.isThinkingImage);
      
      // 如果有非thinking的图片，发送这些；否则发送最后一个thinking图片
      const imagesToSend = finalImages.length > 0 ? finalImages : (thinkingImages.length > 0 ? [thinkingImages[thinkingImages.length - 1]] : []);
      
      if (imagesToSend.length > 0 && !res.closed && !res.destroyed) {
        console.log(`[流式生成][${requestId}] 🖼️  流结束，准备发送 ${imagesToSend.length} 张图片 (${finalImages.length} 张最终图片, ${thinkingImages.length} 张thinking图片)`);
        for (let i = 0; i < imagesToSend.length; i++) {
          const img = imagesToSend[i];
          try {
            const imageDataSize = JSON.stringify({image: {data: img.data, mimeType: img.mimeType}}).length;
            console.log(`[流式生成][${requestId}] 📤 发送图片[${i+1}/${imagesToSend.length}], JSON大小: ${imageDataSize} bytes`);
            res.write(`data: ${JSON.stringify({ 
              image: {
                data: img.data,
                mimeType: img.mimeType
              }
            })}\n\n`);
            console.log(`[流式生成][${requestId}] ✅ 图片[${i+1}]发送成功`);
          } catch (e) {
            console.error(`[流式生成][${requestId}] ❌ 发送图片[${i+1}]失败:`, e);
            console.error(`[流式生成][${requestId}] ❌ 发送错误详情:`, {
              message: e.message,
              code: e.code,
              closed: res.closed,
              destroyed: res.destroyed
            });
          }
        }
      }

      // 只有在连接仍然有效时才发送完成信号
      if (!res.closed && !res.destroyed) {
        console.log(`[流式生成][${requestId}] 📤 发送完成信号...`);
        try {
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();
          console.log(`[流式生成][${requestId}] ✅ 响应已结束`);
        } catch (endError) {
          console.error(`[流式生成][${requestId}] ❌ 结束响应时出错:`, endError);
        }
      } else {
        console.log(`[流式生成][${requestId}] ⚠️  连接已关闭，跳过发送完成信号`);
      }
    } catch (streamError) {
      // 确保停止心跳
      clearInterval(heartbeatInterval);
      
      console.error(`[流式生成][${requestId}] ❌ 流处理错误:`);
      console.error(`[流式生成][${requestId}] ❌ 错误类型: ${streamError.constructor.name}`);
      console.error(`[流式生成][${requestId}] ❌ 错误消息: ${streamError.message}`);
      console.error(`[流式生成][${requestId}] ❌ 错误堆栈:`, streamError.stack);
      console.error(`[流式生成][${requestId}] ❌ 错误详情:`, {
        code: streamError.code,
        errno: streamError.errno,
        syscall: streamError.syscall,
        address: streamError.address,
        port: streamError.port
      });
      console.error(`[流式生成][${requestId}] ❌ 响应状态:`, {
        headersSent: res.headersSent,
        closed: res.closed,
        destroyed: res.destroyed,
        sseHeadersSet: sseHeadersSet
      });
      
      // 如果响应头已设置，使用 SSE 格式发送错误
      if (sseHeadersSet && !res.closed && !res.destroyed) {
        try {
          console.log(`[流式生成][${requestId}] 📤 尝试发送SSE格式错误消息...`);
          
          // 提取详细的错误信息
          let errorMessage = streamError.message || '生成内容失败';
          let errorType = streamError.constructor.name || 'Error';
          
          // 如果是Google API错误，提取详细信息
          if (streamError.status || streamError.statusText) {
            errorMessage = `API错误 (${streamError.status || 'Unknown'}): ${streamError.message || streamError.statusText || '未知错误'}`;
            if (streamError.errorDetails) {
              errorMessage += `\n详细信息: ${JSON.stringify(streamError.errorDetails)}`;
            }
          }
          
          res.write(`data: ${JSON.stringify({ 
            error: errorType,
            message: errorMessage,
            details: streamError.stack ? streamError.stack.substring(0, 500) : undefined
          })}\n\n`);
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();
          console.log(`[流式生成][${requestId}] ✅ 错误消息已发送: ${errorMessage}`);
        } catch (e) {
          console.error(`[流式生成][${requestId}] ❌ 发送错误消息失败:`, e);
          console.error(`[流式生成][${requestId}] ❌ 发送错误详情:`, {
            message: e.message,
            code: e.code,
            closed: res.closed,
            destroyed: res.destroyed
          });
        }
      } else {
        console.log(`[流式生成][${requestId}] ⚠️  SSE响应头未设置或连接已关闭，抛出错误让外层处理`);
        // 如果响应头未设置，抛出错误让外层 catch 处理
        throw streamError;
      }
    }

    // 清理上传的文件
    if (req.files) {
      console.log(`[流式生成][${requestId}] 🧹 清理上传的文件...`);
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
          console.log(`[流式生成][${requestId}] ✅ 已删除文件: ${file.path}`);
        }
      });
    }
    
    const totalDuration = Date.now() - parseInt(requestId.split('-')[1]);
    console.log(`[流式生成][${requestId}] ========== 请求完成，总耗时: ${totalDuration}ms ==========`);
  } catch (error) {
    console.error(`[流式生成][${requestId}] ❌ ========== 请求失败 ==========`);
    console.error(`[流式生成][${requestId}] ❌ 错误类型: ${error.constructor.name}`);
    console.error(`[流式生成][${requestId}] ❌ 错误消息: ${error.message}`);
    console.error(`[流式生成][${requestId}] ❌ 错误堆栈:`, error.stack);
    console.error(`[流式生成][${requestId}] ❌ 错误详情:`, {
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      address: error.address,
      port: error.port
    });
    console.error(`[流式生成][${requestId}] ❌ 响应状态:`, {
      headersSent: res.headersSent,
      closed: res.closed,
      destroyed: res.destroyed,
      contentType: res.getHeader('Content-Type')
    });
    
    // 清理上传的文件
    if (req.files) {
      console.log(`[流式生成][${requestId}] 🧹 清理上传的文件...`);
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
          console.log(`[流式生成][${requestId}] ✅ 已删除文件: ${file.path}`);
        }
      });
    }

    // 检查响应头是否已设置（SSE 模式）
    const isSSE = res.getHeader('Content-Type') === 'text/event-stream';
    console.log(`[流式生成][${requestId}] 🔍 响应头检查: isSSE=${isSSE}, headersSent=${res.headersSent}`);
    
    if (isSSE) {
      // 如果已经设置了 SSE 响应头，使用 SSE 格式发送错误
      if (!res.closed && !res.destroyed) {
        try {
          console.log(`[流式生成][${requestId}] 📤 发送SSE格式错误消息...`);
          
          // 提取详细的错误信息
          let errorMessage = error.message || '生成内容失败';
          let errorType = error.constructor.name || 'Error';
          
          // 如果是Google API错误，提取详细信息
          if (error.status || error.statusText) {
            errorMessage = `API错误 (${error.status || 'Unknown'}): ${error.message || error.statusText || '未知错误'}`;
            if (error.errorDetails) {
              errorMessage += `\n详细信息: ${JSON.stringify(error.errorDetails)}`;
            }
          }
          
          // 如果是文件类型错误，提供更友好的提示
          if (error.message && error.message.includes('只支持图片文件')) {
            errorMessage = `文件类型错误: ${error.message}\n请确保上传的文件是图片格式 (jpeg, jpg, png, gif, webp)`;
          }
          
          res.write(`data: ${JSON.stringify({ 
            error: errorType,
            message: errorMessage,
            details: error.stack ? error.stack.substring(0, 500) : undefined
          })}\n\n`);
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();
          console.log(`[流式生成][${requestId}] ✅ 错误消息已发送: ${errorMessage}`);
        } catch (e) {
          console.error(`[流式生成][${requestId}] ❌ 发送错误消息失败:`, e);
          console.error(`[流式生成][${requestId}] ❌ 发送错误详情:`, {
            message: e.message,
            code: e.code,
            closed: res.closed,
            destroyed: res.destroyed
          });
          // 如果写入失败，尝试关闭连接
          if (!res.closed && !res.destroyed) {
            try {
              res.end();
            } catch (endError) {
              console.error(`[流式生成][${requestId}] ❌ 关闭连接失败:`, endError);
            }
          }
        }
      } else {
        console.log(`[流式生成][${requestId}] ⚠️  连接已关闭，无法发送错误消息`);
      }
    } else {
      // 如果还没有设置响应头，可以发送 JSON 响应
      if (!res.headersSent) {
        console.log(`[流式生成][${requestId}] 📤 发送JSON格式错误响应...`);
        try {
          res.status(500).json({ 
            error: '生成内容失败',
            message: error.message 
          });
          console.log(`[流式生成][${requestId}] ✅ JSON错误响应已发送`);
        } catch (jsonError) {
          console.error(`[流式生成][${requestId}] ❌ 发送JSON响应失败:`, jsonError);
        }
      } else {
        // 如果响应头已发送但格式不对，只能关闭连接
        console.error(`[流式生成][${requestId}] ⚠️  响应头已发送但格式不对，关闭连接`);
        if (!res.closed && !res.destroyed) {
          try {
            res.end();
          } catch (endError) {
            console.error(`[流式生成][${requestId}] ❌ 关闭连接失败:`, endError);
          }
        }
      }
    }
    
    const totalDuration = Date.now() - parseInt(requestId.split('-')[1]);
    console.log(`[流式生成][${requestId}] ========== 请求结束（失败），总耗时: ${totalDuration}ms ==========`);
  }
});

// 检查 Google AI API Key（可选，但建议配置）
if (!process.env.GOOGLE_AI_API_KEY) {
  console.warn('⚠️  警告: GOOGLE_AI_API_KEY 未设置，AI 功能将不可用');
  console.warn('   请在 .env 文件中配置 GOOGLE_AI_API_KEY');
}

app.listen(PORT, () => {
  console.log(`✅ 后端服务器运行在 http://localhost:${PORT}`);
  console.log(`   默认用户: ${defaultUserName}`);
  if (!genAI) {
    console.warn('⚠️  警告: GOOGLE_AI_API_KEY 未设置，AI 功能将不可用');
  }
});

