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
      images?: Array<{ data: string; mimeType: string }>;
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
      images?: Array<{ data: string; mimeType: string }>;
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

    // 使用相对路径或绝对路径
    const streamUrl = API_URL ? `${API_URL}/api/generate/stream` : '/api/generate/stream';
    const response = await fetch(streamUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('生成失败');
    }

    return response;
  },
};

