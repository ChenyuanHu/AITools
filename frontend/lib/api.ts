import axios from 'axios';

// 使用相对路径，Next.js rewrites 会将请求代理到后端
// 如果设置了 NEXT_PUBLIC_API_URL，则使用绝对路径（用于开发环境直接连接后端）
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：添加token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器：处理401错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: async (name: string, password: string) => {
    const response = await api.post('/api/auth/login', { name, password });
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },
};

export const modelsAPI = {
  getModels: async () => {
    const response = await api.get('/api/models');
    return response.data;
  },
};

export const generateAPI = {
  generate: async (data: {
    prompt: string;
    modelId?: string;
    temperature?: number;
    systemInstruction?: string;
    images?: File[];
    history?: Array<{
      role: 'user' | 'assistant';
      content: string;
      images?: Array<{ data: string; mimeType: string; thoughtSignature?: string }>;
    }>;
  }) => {
    const formData = new FormData();
    formData.append('prompt', data.prompt);
    if (data.modelId) formData.append('modelId', data.modelId);
    if (data.temperature !== undefined) formData.append('temperature', data.temperature.toString());
    if (data.systemInstruction) formData.append('systemInstruction', data.systemInstruction);
    
    if (data.history && data.history.length > 0) {
      formData.append('history', JSON.stringify(data.history));
    }
    
    if (data.images) {
      data.images.forEach((image) => {
        formData.append('images', image);
      });
    }

    const response = await api.post('/api/generate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  generateStream: async (data: {
    prompt: string;
    modelId?: string;
    temperature?: number;
    systemInstruction?: string;
    images?: File[];
    history?: Array<{
      role: 'user' | 'assistant';
      content: string;
      images?: Array<{ data: string; mimeType: string; thoughtSignature?: string }>;
    }>;
    includeThoughts?: boolean; // 是否包含thinking过程
    thinkingLevel?: string; // Gemini 3 Pro的thinking级别: "low" 或 "high"
    thinkingBudget?: number; // Gemini 2.5系列的thinking预算
    aspectRatio?: string; // 图片宽高比
    imageSize?: string; // 图片分辨率 (1K, 2K, 4K)
    responseModalities?: string[]; // 响应类型 (TEXT, IMAGE)
  }) => {
    const formData = new FormData();
    formData.append('prompt', data.prompt);
    if (data.modelId) formData.append('modelId', data.modelId);
    if (data.temperature !== undefined) formData.append('temperature', data.temperature.toString());
    if (data.systemInstruction) formData.append('systemInstruction', data.systemInstruction);
    
    // 添加thinking相关参数
    if (data.includeThoughts !== undefined) {
      formData.append('includeThoughts', data.includeThoughts.toString());
    }
    if (data.thinkingLevel) {
      formData.append('thinkingLevel', data.thinkingLevel);
    }
    if (data.thinkingBudget !== undefined) {
      formData.append('thinkingBudget', data.thinkingBudget.toString());
    }
    
    // 添加图片生成参数
    if (data.aspectRatio) {
      formData.append('aspectRatio', data.aspectRatio);
    }
    if (data.imageSize) {
      formData.append('imageSize', data.imageSize);
    }
    if (data.responseModalities && data.responseModalities.length > 0) {
      formData.append('responseModalities', JSON.stringify(data.responseModalities));
    }
    
    if (data.history && data.history.length > 0) {
      formData.append('history', JSON.stringify(data.history));
    }
    
    if (data.images) {
      data.images.forEach((image) => {
        formData.append('images', image);
      });
    }

    // 使用相对路径或绝对路径
    const streamUrl = API_URL ? `${API_URL}/api/generate/stream` : '/api/generate/stream';
    
    let response: Response;
    try {
      response = await fetch(streamUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });
    } catch (fetchError: any) {
      // 网络错误（如连接失败、超时等）
      const errorMessage = fetchError.message || '网络请求失败';
      const detailedError = new Error(`网络错误: ${errorMessage}`);
      (detailedError as any).details = `无法连接到服务器。请检查：\n1. 服务器是否正在运行\n2. 网络连接是否正常\n3. 服务器地址是否正确\n\n原始错误: ${fetchError.message || 'Unknown error'}`;
      throw detailedError;
    }

    if (!response.ok) {
      // 尝试读取响应体中的错误信息
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorDetails = '';
      
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
          errorDetails = errorData.details || errorData.stack || '';
        } else {
          const text = await response.text();
          if (text) {
            errorDetails = text;
            // 尝试从文本中提取 JSON 错误信息
            try {
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const errorData = JSON.parse(jsonMatch[0]);
                errorMessage = errorData.message || errorData.error || errorMessage;
                errorDetails = errorData.details || errorData.stack || errorDetails;
              }
            } catch (e) {
              // 如果解析失败，使用原始文本
              errorDetails = text;
            }
          }
        }
      } catch (readError) {
        // 如果读取响应体失败，使用状态码信息
        console.error('[API] 读取错误响应失败:', readError);
      }
      
      const error = new Error(errorMessage);
      (error as any).details = errorDetails || `服务器返回了错误状态码: ${response.status} ${response.statusText}`;
      throw error;
    }

    return response;
  },
};

