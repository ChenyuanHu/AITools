'use client';

import { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import MainContent from './MainContent';
import SettingsPanel from './SettingsPanel';
import { modelsAPI, generateAPI } from '@/lib/api';
import { Settings, X } from 'lucide-react';

interface Model {
  id: string;
  name: string;
  description: string;
  type: string;
  isNew?: boolean;
}

interface User {
  id: number;
  email: string;
  name: string;
}

export default function Playground() {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [selectedTab, setSelectedTab] = useState('gemini');
  const [showSettings, setShowSettings] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  // 设置状态
  const [temperature, setTemperature] = useState(1);
  const [systemInstruction, setSystemInstruction] = useState('');
  const [outputLength, setOutputLength] = useState(65536);
  const [topP, setTopP] = useState(0.95);
  const [grounding, setGrounding] = useState(true);
  const [urlContext, setUrlContext] = useState(true);

  useEffect(() => {
    // 加载用户信息
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setUser(JSON.parse(userStr));
    }

    // 加载模型列表
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const modelList = await modelsAPI.getModels();
      setModels(modelList);
      if (modelList.length > 0) {
        setSelectedModel(modelList[0]);
      }
    } catch (error) {
      console.error('加载模型失败:', error);
    }
  };

  const handleGenerate = async (prompt: string, images: File[]) => {
    if (!selectedModel) return;

    setLoading(true);
    try {
      const result = await generateAPI.generate({
        prompt,
        modelId: selectedModel.id,
        temperature,
        systemInstruction: systemInstruction || undefined,
        images: images.length > 0 ? images : undefined,
      });
      return result;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || '生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateStream = async (
    prompt: string,
    images: File[],
    onChunk: (text: string) => void,
    onImage?: (image: { data: string; mimeType: string }) => void,
    onComplete?: () => void
  ) => {
    if (!selectedModel) return;

    setLoading(true);
    try {
      const response = await generateAPI.generateStream({
        prompt,
        modelId: selectedModel.id,
        temperature,
        systemInstruction: systemInstruction || undefined,
        images: images.length > 0 ? images : undefined,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取流');
      }

      let buffer = ''; // 用于累积可能被分割的数据
      let currentDataLine = ''; // 当前正在累积的 data 行
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        buffer += chunk;
        
        // 处理完整的行
        while (buffer.includes('\n')) {
          const newlineIndex = buffer.indexOf('\n');
          const line = buffer.substring(0, newlineIndex);
          buffer = buffer.substring(newlineIndex + 1);
          
          if (line.startsWith('data: ')) {
            // 如果之前有未完成的 data 行，先处理它
            if (currentDataLine) {
              currentDataLine += line.slice(6); // 拼接 JSON 数据
            } else {
              currentDataLine = line.slice(6);
            }
            
            // 尝试解析 JSON
            try {
              const data = JSON.parse(currentDataLine);
              currentDataLine = ''; // 清空，表示已成功解析
              
              if (data.done) {
                if (onComplete) onComplete();
                setLoading(false);
                return;
              }
              if (data.text) {
                onChunk(data.text);
              }
              if (data.image) {
                console.log('[前端] 收到图片数据，MIME类型:', data.image.mimeType, '数据长度:', data.image.data?.length || 0);
                if (onImage) {
                  onImage(data.image);
                  console.log('[前端] 图片数据已传递给回调');
                } else {
                  console.warn('[前端] onImage 回调未定义');
                }
              }
            } catch (e) {
              // JSON 解析失败，可能是数据被分割了，继续累积
              // 检查是否是未完成的字符串（图片数据）
              if (e instanceof SyntaxError && (e.message.includes('Unterminated') || e.message.includes('Unexpected'))) {
                // 继续累积，不重置 currentDataLine
                continue;
              } else {
                console.error('[前端] JSON 解析错误:', e, '数据长度:', currentDataLine.length);
                currentDataLine = ''; // 重置，避免无限累积错误数据
              }
            }
          } else if (currentDataLine) {
            // 如果当前有未完成的 data 行，且这行不是 data: 开头，说明是上一行的延续
            currentDataLine += '\n' + line;
            // 尝试解析
            try {
              const data = JSON.parse(currentDataLine);
              currentDataLine = '';
              
              if (data.done) {
                if (onComplete) onComplete();
                setLoading(false);
                return;
              }
              if (data.text) {
                onChunk(data.text);
              }
              if (data.image) {
                console.log('[前端] 收到图片数据（拼接后），MIME类型:', data.image.mimeType, '数据长度:', data.image.data?.length || 0);
                if (onImage) {
                  onImage(data.image);
                }
              }
            } catch (e) {
              // 继续累积
              if (!(e instanceof SyntaxError)) {
                console.error('[前端] JSON 解析错误:', e);
                currentDataLine = '';
              }
            }
          }
        }
      }
      
      // 处理最后剩余的数据
      if (currentDataLine) {
        try {
          const data = JSON.parse(currentDataLine);
          if (data.done) {
            if (onComplete) onComplete();
            setLoading(false);
            return;
          }
          if (data.text) {
            onChunk(data.text);
          }
          if (data.image) {
            console.log('[前端] 收到图片数据（最后一块），MIME类型:', data.image.mimeType, '数据长度:', data.image.data?.length || 0);
            if (onImage) {
              onImage(data.image);
            }
          }
        } catch (e) {
          console.error('[前端] 处理最后数据块时出错:', e);
        }
      }
    } catch (error: any) {
      setLoading(false);
      throw new Error(error.message || '生成失败');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部横幅 */}
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-yellow-800">
            <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
            <span>您正在使用付费API密钥。此会话中的所有请求都将被计费。</span>
          </div>
          <button
            onClick={() => {}}
            className="text-yellow-600 hover:text-yellow-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 主内容区域 */}
        <div className="flex-1 flex overflow-hidden">
          <MainContent
            models={models}
            selectedModel={selectedModel}
            selectedTab={selectedTab}
            onSelectModel={setSelectedModel}
            onSelectTab={setSelectedTab}
            onGenerate={handleGenerate}
            onGenerateStream={handleGenerateStream}
            loading={loading}
          />

          {/* 设置面板 */}
          {showSettings && (
            <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
              <SettingsPanel
                model={selectedModel}
                temperature={temperature}
                systemInstruction={systemInstruction}
                outputLength={outputLength}
                topP={topP}
                grounding={grounding}
                urlContext={urlContext}
                onTemperatureChange={setTemperature}
                onSystemInstructionChange={setSystemInstruction}
                onOutputLengthChange={setOutputLength}
                onTopPChange={setTopP}
                onGroundingChange={setGrounding}
                onUrlContextChange={setUrlContext}
                onClose={() => setShowSettings(false)}
              />
            </div>
          )}

          {/* 设置按钮 */}
          {!showSettings && (
            <button
              onClick={() => setShowSettings(true)}
              className="fixed right-4 top-20 bg-white border border-gray-300 rounded-lg p-2 shadow-lg hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

