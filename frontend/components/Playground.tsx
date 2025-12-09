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
    onComplete: () => void
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) {
                onComplete();
                setLoading(false);
                return;
              }
              if (data.text) {
                onChunk(data.text);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
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

