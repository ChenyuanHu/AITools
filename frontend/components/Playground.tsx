'use client';

import { useState, useEffect } from 'react';
import Sidebar, { loadConversations, saveConversations, createConversation, type Conversation } from './Sidebar';
import MainContent from './MainContent';
import SettingsPanel from './SettingsPanel';
import { modelsAPI, generateAPI } from '@/lib/api';
import { Settings, X, Menu } from 'lucide-react';

interface Model {
  id: string;
  name: string;
  description: string;
  type: string;
  isNew?: boolean;
}

interface User {
  id: number;
  name: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  images?: Array<{ data: string; mimeType: string; thoughtSignature?: string }>;
  thinking?: string; // thinking内容（思考过程）
}

export default function Playground() {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [selectedTab, setSelectedTab] = useState('gemini');
  const [showSettings, setShowSettings] = useState(false); // 默认隐藏设置面板
  const [showSidebar, setShowSidebar] = useState(false); // 移动端侧边栏显示状态
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  // 会话管理
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // 设置状态
  const [temperature, setTemperature] = useState(1);
  const [systemInstruction, setSystemInstruction] = useState('');
  const [includeThoughts, setIncludeThoughts] = useState(true); // 默认启用thinking
  const [thinkingLevel, setThinkingLevel] = useState('high'); // 默认high级别（深度思考）
  // 图片生成参数
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');
  const [responseModalities, setResponseModalities] = useState<string[]>(['TEXT', 'IMAGE']);

  useEffect(() => {
    // 加载用户信息
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const userData = JSON.parse(userStr);
      setUser({ id: userData.id, name: userData.name });
    }

    // 加载模型列表
    loadModels();

    // 加载会话列表
    const loadData = async () => {
      try {
        const loadedConversations = await loadConversations();
        setConversations(loadedConversations);

        // 如果有会话，选择最新的一个
        if (loadedConversations.length > 0) {
          const latest = loadedConversations.sort((a, b) => b.updatedAt - a.updatedAt)[0];
          setCurrentConversationId(latest.id);
          setMessages(latest.messages);
        } else {
          // 创建新会话
          handleNewConversation();
        }
      } catch (error) {
        console.error('加载会话失败:', error);
      }
    };
    
    loadData();
  }, []);

  const handleNewConversation = async () => {
    const newConversation = createConversation('新会话');
    setConversations((prev) => {
      const updated = [newConversation, ...prev];
      saveConversations(updated).catch(error => {
        console.error('保存会话失败:', error);
      });
      return updated;
    });
    setCurrentConversationId(newConversation.id);
    setMessages([]);
  };

  const handleSelectConversation = (id: string) => {
    setConversations((prev) => {
      const conversation = prev.find((c) => c.id === id);
      if (conversation) {
        setCurrentConversationId(id);
        setMessages(conversation.messages);
      }
      return prev;
    });
  };

  const handleDeleteConversation = async (id: string) => {
    const updated = conversations.filter((c) => c.id !== id);
    setConversations(updated);
    try {
      await saveConversations(updated);
    } catch (error) {
      console.error('保存会话失败:', error);
    }
    
    if (currentConversationId === id) {
      if (updated.length > 0) {
        const latest = updated.sort((a, b) => b.updatedAt - a.updatedAt)[0];
        setCurrentConversationId(latest.id);
        setMessages(latest.messages);
      } else {
        handleNewConversation();
      }
    }
  };

  const handleMessageSent = (message: Message) => {
    if (!currentConversationId) return;

    setMessages((prevMessages) => {
      const updatedMessages = [...prevMessages, message];
      
      // 更新会话
      setConversations((prevConversations) => {
        const updated = prevConversations.map((conv) => {
          if (conv.id === currentConversationId) {
            const updatedConv = {
              ...conv,
              messages: updatedMessages,
              updatedAt: Date.now(),
              title: conv.messages.length === 0 && message.role === 'user' 
                ? message.content.substring(0, 30) || '新会话'
                : conv.title,
            };
            return updatedConv;
          }
          return conv;
        });
        saveConversations(updated).catch(error => {
          console.error('保存会话失败:', error);
        });
        return updated;
      });
      
      return updatedMessages;
    });
  };

  // 编辑消息
  const handleEditMessage = async (messageIndex: number, newContent: string, newImages?: File[]) => {
    if (!currentConversationId) return;
    
    // 转换图片（如果有）
    let imageData: Array<{ data: string; mimeType: string; thoughtSignature?: string }> | undefined;
    if (newImages && newImages.length > 0) {
      imageData = await Promise.all(
        newImages.map((file) => {
          return new Promise<{ data: string; mimeType: string }>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result as string;
              resolve({
                data: base64.split(',')[1] || base64,
                mimeType: file.type,
              });
            };
            reader.readAsDataURL(file);
          });
        })
      );
    }
    
    setMessages((prevMessages) => {
      const updatedMessages = [...prevMessages];
      
      // 更新用户消息
      if (updatedMessages[messageIndex] && updatedMessages[messageIndex].role === 'user') {
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          content: newContent,
          images: imageData && imageData.length > 0 ? imageData : updatedMessages[messageIndex].images,
        };
      }
      
      // 更新会话
      setConversations((prevConversations) => {
        const updated = prevConversations.map((conv) => {
          if (conv.id === currentConversationId) {
            return {
              ...conv,
              messages: updatedMessages,
              updatedAt: Date.now(),
            };
          }
          return conv;
        });
        saveConversations(updated).catch(error => {
          console.error('保存会话失败:', error);
        });
        return updated;
      });
      
      return updatedMessages;
    });
  };

  // 截断消息（删除指定索引之后的所有消息）
  const handleTruncateMessages = (keepUntilIndex: number) => {
    if (!currentConversationId) return;
    
    setMessages((prevMessages) => {
      const truncatedMessages = prevMessages.slice(0, keepUntilIndex + 1);
      
      // 更新会话
      setConversations((prevConversations) => {
        const updated = prevConversations.map((conv) => {
          if (conv.id === currentConversationId) {
            return {
              ...conv,
              messages: truncatedMessages,
              updatedAt: Date.now(),
            };
          }
          return conv;
        });
        saveConversations(updated).catch(error => {
          console.error('保存会话失败:', error);
        });
        return updated;
      });
      
      return truncatedMessages;
    });
  };

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
    history: Message[],
    onChunk: (text: string) => void,
    onImage?: (image: { data: string; mimeType: string; thoughtSignature?: string }) => void,
    onComplete?: () => void,
    onThinking?: (thinking: string) => void // 新增thinking回调
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
        history: history, // 传递历史消息
        includeThoughts: includeThoughts, // 使用配置的thinking设置
        thinkingLevel: thinkingLevel, // 使用配置的thinking级别
        aspectRatio: selectedModel.id.includes('image') ? aspectRatio : undefined,
        imageSize: selectedModel.id === 'gemini-3-pro-image-preview' ? imageSize : undefined,
        responseModalities: selectedModel.id.includes('image') ? responseModalities : undefined,
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
              // 处理错误数据
              if (data.error) {
                console.error('[前端] 收到错误数据:', data.error, data.message);
                const error = new Error(data.message || data.error || '生成失败');
                (error as any).details = data.details;
                throw error;
              }
              // 处理thinking数据（思考过程）
              if (data.thinking) {
                console.log('[前端] 收到thinking数据:', data.thinking.substring(0, 100));
                // 调用thinking回调
                if (onThinking) {
                  onThinking(data.thinking);
                }
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
              // 处理错误数据
              if (data.error) {
                console.error('[前端] 收到错误数据（拼接后）:', data.error, data.message);
                const error = new Error(data.message || data.error || '生成失败');
                (error as any).details = data.details;
                throw error;
              }
              // 处理thinking数据（思考过程）
              if (data.thinking) {
                console.log('[前端] 收到thinking数据（拼接后）:', data.thinking.substring(0, 100));
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
          // 处理错误数据
          if (data.error) {
            console.error('[前端] 收到错误数据（最后一块）:', data.error, data.message);
            const error = new Error(data.message || data.error || '生成失败');
            (error as any).details = data.details;
            throw error;
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
          if (e instanceof Error && e.message !== '生成失败') {
            throw e; // 如果是我们抛出的错误，继续抛出
          }
          console.error('[前端] 处理最后数据块时出错:', e);
        }
      }
    } catch (error: any) {
      setLoading(false);
      
      // 如果错误已经有详细信息，直接抛出
      if (error.details) {
        throw error;
      }
      
      // 处理不同类型的错误
      let errorMessage = '生成失败';
      let errorDetails = '';
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      // 网络错误
      if (error.message === 'Failed to fetch' || error.message?.includes('fetch')) {
        errorMessage = '网络请求失败';
        errorDetails = '无法连接到服务器。可能的原因：\n1. 服务器未运行或无法访问\n2. 网络连接问题\n3. 服务器地址配置错误\n4. CORS 跨域问题\n\n请检查网络连接和服务器状态。';
      }
      // TypeError（通常是网络相关）
      else if (error instanceof TypeError) {
        errorMessage = `网络错误: ${error.message}`;
        errorDetails = `请求过程中发生网络错误。\n\n错误类型: ${error.name}\n错误信息: ${error.message}\n\n请检查网络连接。`;
      }
      // 其他错误
      else {
        errorDetails = error.stack || error.toString();
      }
      
      const detailedError = new Error(errorMessage);
      (detailedError as any).details = errorDetails;
      throw detailedError;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 relative">
      {/* 移动端遮罩层 */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* 侧边栏 */}
      <div
        className={`fixed md:static inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out ${
          showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <Sidebar
          user={user}
          currentConversationId={currentConversationId}
          conversations={conversations}
          onSelectConversation={(id) => {
            handleSelectConversation(id);
            setShowSidebar(false); // 移动端选择会话后关闭侧边栏
          }}
          onNewConversation={() => {
            handleNewConversation();
            setShowSidebar(false); // 移动端新建会话后关闭侧边栏
          }}
          onDeleteConversation={handleDeleteConversation}
          onClose={() => setShowSidebar(false)}
        />
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部横幅 */}
        <div className="bg-yellow-50 border-b border-yellow-200 px-3 md:px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs md:text-sm text-yellow-800 flex-1 min-w-0">
            <span className="w-2 h-2 bg-yellow-500 rounded-full flex-shrink-0"></span>
            <span className="truncate">您正在使用付费API密钥。此会话中的所有请求都将被计费。</span>
          </div>
          <button
            onClick={() => {}}
            className="text-yellow-600 hover:text-yellow-800 flex-shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 移动端顶部栏 */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <button
            onClick={() => setShowSidebar(true)}
            className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">My AI Studio</h1>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* 主内容区域 */}
        <div className="flex-1 flex overflow-hidden">
          <MainContent
            models={models}
            selectedModel={selectedModel}
            selectedTab={selectedTab}
            messages={messages}
            onSelectModel={setSelectedModel}
            onSelectTab={setSelectedTab}
            onGenerate={handleGenerate}
            onGenerateStream={handleGenerateStream}
            loading={loading}
            onMessageSent={handleMessageSent}
            onEditMessage={handleEditMessage}
            onTruncateMessages={handleTruncateMessages}
          />

          {/* 设置面板 - 桌面端 */}
          {showSettings && (
            <div className="hidden md:block w-80 border-l border-gray-200 bg-white overflow-y-auto">
              <SettingsPanel
                model={selectedModel}
                temperature={temperature}
                systemInstruction={systemInstruction}
                includeThoughts={includeThoughts}
                thinkingLevel={thinkingLevel}
                aspectRatio={aspectRatio}
                imageSize={imageSize}
                responseModalities={responseModalities}
                onTemperatureChange={setTemperature}
                onSystemInstructionChange={setSystemInstruction}
                onIncludeThoughtsChange={setIncludeThoughts}
                onThinkingLevelChange={setThinkingLevel}
                onAspectRatioChange={setAspectRatio}
                onImageSizeChange={setImageSize}
                onResponseModalitiesChange={setResponseModalities}
                onClose={() => setShowSettings(false)}
              />
            </div>
          )}

          {/* 设置面板 - 移动端全屏 */}
          {showSettings && (
            <div className="md:hidden fixed inset-0 z-50 bg-white">
              <SettingsPanel
                model={selectedModel}
                temperature={temperature}
                systemInstruction={systemInstruction}
                includeThoughts={includeThoughts}
                thinkingLevel={thinkingLevel}
                aspectRatio={aspectRatio}
                imageSize={imageSize}
                responseModalities={responseModalities}
                onTemperatureChange={setTemperature}
                onSystemInstructionChange={setSystemInstruction}
                onIncludeThoughtsChange={setIncludeThoughts}
                onThinkingLevelChange={setThinkingLevel}
                onAspectRatioChange={setAspectRatio}
                onImageSizeChange={setImageSize}
                onResponseModalitiesChange={setResponseModalities}
                onClose={() => setShowSettings(false)}
              />
            </div>
          )}

          {/* 设置按钮 - 桌面端 */}
          {!showSettings && (
            <button
              onClick={() => setShowSettings(true)}
              className="hidden md:flex fixed right-4 top-20 bg-white border border-gray-300 rounded-lg p-2 shadow-lg hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

