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

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 内存存储用户（生产环境应使用数据库）
const users = [
  {
    id: 1,
    password: bcrypt.hashSync('cheneyhu', 10), // 默认密码
    name: 'cheneyhu'
  }
];

// 中间件
app.use(cors());
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
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({ error: '姓名和密码是必填项' });
    }

    const user = users.find(u => u.name === name);
    if (!user) {
      return res.status(401).json({ error: '姓名或密码错误' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: '姓名或密码错误' });
    }

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
      name: 'Gemini 3 Pro Image Preview',
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
      name: 'Gemini 2.5 Flash Image',
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

    const { prompt, modelId = 'gemini-3-pro-preview', temperature = 1, systemInstruction } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: '提示词不能为空' });
    }

    // 映射模型ID到实际的模型名称
    const actualModelName = modelNameMap[modelId] || modelId;
    console.log(`[流式生成] 使用模型: ${modelId} -> ${actualModelName}`);
    
    let model;
    try {
      model = genAI.getGenerativeModel({ 
        model: actualModelName,
        systemInstruction: systemInstruction || undefined
      });
    } catch (error) {
      console.error(`[流式生成] 模型初始化错误:`, error);
      // 如果模型名称失败，尝试使用原始ID
      if (actualModelName !== modelId) {
        console.log(`[流式生成] 尝试使用原始模型ID: ${modelId}`);
        model = genAI.getGenerativeModel({ 
          model: modelId,
          systemInstruction: systemInstruction || undefined
        });
      } else {
        throw error;
      }
    }

    // 构建请求内容
    const parts = [{ text: prompt }];

    // 如果有图片，添加图片到parts
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const imageData = fs.readFileSync(file.path);
        const base64Image = imageData.toString('base64');
        parts.push({
          inlineData: {
            data: base64Image,
            mimeType: file.mimetype
          }
        });
      }
    }

    // 检查是否是图片生成模型
    const isImageModel = modelId.includes('image') || modelId === 'gemini-2.5-flash-image';
    
    // 生成内容
    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
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
  try {
    if (!genAI) {
      return res.status(500).json({ error: 'Google AI API密钥未配置' });
    }

    const { prompt, modelId = 'gemini-3-pro-preview', temperature = 1, systemInstruction } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: '提示词不能为空' });
    }

    // 映射模型ID到实际的模型名称
    const actualModelName = modelNameMap[modelId] || modelId;
    console.log(`[流式生成] 使用模型: ${modelId} -> ${actualModelName}`);
    
    let model;
    try {
      model = genAI.getGenerativeModel({ 
        model: actualModelName,
        systemInstruction: systemInstruction || undefined
      });
    } catch (error) {
      console.error(`[流式生成] 模型初始化错误:`, error);
      // 如果模型名称失败，尝试使用原始ID
      if (actualModelName !== modelId) {
        console.log(`[流式生成] 尝试使用原始模型ID: ${modelId}`);
        model = genAI.getGenerativeModel({ 
          model: modelId,
          systemInstruction: systemInstruction || undefined
        });
      } else {
        throw error;
      }
    }

    // 构建请求内容
    const parts = [{ text: prompt }];

    // 如果有图片，添加图片到parts
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const imageData = fs.readFileSync(file.path);
        const base64Image = imageData.toString('base64');
        parts.push({
          inlineData: {
            data: base64Image,
            mimeType: file.mimetype
          }
        });
      }
    }

    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 检查是否是图片生成模型
    const isImageModel = modelId.includes('image') || modelId === 'gemini-2.5-flash-image';
    
    // 生成流式内容
    const result = await model.generateContentStream({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: parseFloat(temperature),
        topP: 0.95,
        maxOutputTokens: 65536,
        ...(isImageModel && { responseModalities: ['TEXT', 'IMAGE'] }) // 图片生成模型同时支持文本和图片
      }
    });

    // 收集所有图片数据，在流结束时一次性发送
    const collectedImages = [];
    
    for await (const chunk of result.stream) {
      // 检查是否有文本内容
      try {
        const chunkText = chunk.text();
        if (chunkText) {
          res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
        }
      } catch (e) {
        // text() 可能抛出错误，忽略
      }
      
      // 收集图片数据（不立即发送，避免大数据导致的问题）
      try {
        const candidates = chunk.candidates;
        if (candidates && candidates.length > 0) {
          const content = candidates[0].content;
          if (content && content.parts) {
            for (const part of content.parts) {
              if (part.inlineData) {
                console.log('[流式生成] 收集到图片数据，MIME类型:', part.inlineData.mimeType, '数据长度:', part.inlineData.data?.length || 0);
                collectedImages.push({
                  data: part.inlineData.data,
                  mimeType: part.inlineData.mimeType
                });
              }
            }
          }
        }
      } catch (e) {
        console.error('[流式生成] 收集图片数据时出错:', e);
      }
    }
    
    // 流结束后，一次性发送所有图片
    if (collectedImages.length > 0) {
      console.log('[流式生成] 流结束，准备发送', collectedImages.length, '张图片');
      for (const img of collectedImages) {
        try {
          res.write(`data: ${JSON.stringify({ 
            image: {
              data: img.data,
              mimeType: img.mimeType
            }
          })}\n\n`);
          console.log('[流式生成] 图片数据已发送，大小:', JSON.stringify({image: img}).length);
        } catch (e) {
          console.error('[流式生成] 发送图片数据失败:', e);
        }
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

    // 清理上传的文件
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
  } catch (error) {
    console.error('流式生成错误:', error);
    
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

app.listen(PORT, () => {
  console.log(`后端服务器运行在 http://localhost:${PORT}`);
  if (!genAI) {
    console.warn('警告: GOOGLE_AI_API_KEY 未设置，请配置环境变量');
  }
});

