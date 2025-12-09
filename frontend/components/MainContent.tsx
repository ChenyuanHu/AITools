'use client';

import { useState, useRef } from 'react';
import { Copy, ExternalLink, Send, Image as ImageIcon, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

interface Model {
  id: string;
  name: string;
  description: string;
  type: string;
  isNew?: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  images?: Array<{ data: string; mimeType: string }>;
}

interface MainContentProps {
  models: Model[];
  selectedModel: Model | null;
  selectedTab: string;
  messages: Message[];
  onSelectModel: (model: Model) => void;
  onSelectTab: (tab: string) => void;
  onGenerate: (prompt: string, images: File[]) => Promise<any>;
  onGenerateStream: (
    prompt: string,
    images: File[],
    onChunk: (text: string) => void,
    onImage?: (image: { data: string; mimeType: string }) => void,
    onComplete?: () => void
  ) => Promise<void>;
  loading: boolean;
  onMessageSent: (message: Message) => void;
}

export default function MainContent({
  models,
  selectedModel,
  selectedTab,
  messages,
  onSelectModel,
  onSelectTab,
  onGenerate,
  onGenerateStream,
  loading,
  onMessageSent,
}: MainContentProps) {
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [currentImages, setCurrentImages] = useState<Array<{ data: string; mimeType: string }>>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const responseEndRef = useRef<HTMLDivElement>(null);

  const filteredModels = models.filter((model) => {
    if (selectedTab === 'gemini') return model.type === 'gemini';
    if (selectedTab === 'featured') return model.isNew;
    return true;
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
    },
    onDrop: (acceptedFiles) => {
      setImages((prev) => [...prev, ...acceptedFiles]);
    },
    multiple: true,
    noClick: true, // 禁用点击触发，只保留拖拽功能
  });

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || loading || isStreaming) return;

    const userPrompt = prompt.trim();
    const userImages = [...images];
    
    // 将图片转换为 base64 以便存储
    const imagePromises = userImages.map((file) => {
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
    });
    
    const imageData = await Promise.all(imagePromises);
    
    // 保存用户消息
    onMessageSent({
      role: 'user',
      content: userPrompt,
      images: imageData.length > 0 ? imageData : undefined,
    });

    // 清空输入
    setPrompt('');
    setImages([]);
    setCurrentResponse('');
    setCurrentImages([]);
    setIsStreaming(true);

    try {
      let fullResponse = '';
      const responseImages: Array<{ data: string; mimeType: string }> = [];
      
      await onGenerateStream(
        userPrompt,
        userImages,
        (chunk) => {
          fullResponse += chunk;
          setCurrentResponse(fullResponse);
          // 自动滚动到底部
          setTimeout(() => {
            responseEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 0);
        },
        (image) => {
          console.log('[前端] MainContent 收到图片:', {
            mimeType: image.mimeType,
            dataLength: image.data?.length || 0,
          });
          if (!image.data || !image.mimeType) {
            console.error('[前端] 图片数据格式不正确:', image);
            return;
          }
          responseImages.push(image);
          setCurrentImages([...responseImages]);
          setTimeout(() => {
            responseEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 0);
        },
        () => {
          setIsStreaming(false);
          // 保存助手回复
          if (fullResponse || responseImages.length > 0) {
            onMessageSent({
              role: 'assistant',
              content: fullResponse,
              images: responseImages.length > 0 ? responseImages : undefined,
            });
          }
          // 延迟清空，确保消息已保存
          setTimeout(() => {
            setCurrentResponse('');
            setCurrentImages([]);
          }, 100);
        }
      );
    } catch (error: any) {
      setIsStreaming(false);
      onMessageSent({
        role: 'assistant',
        content: `错误: ${error.message}`,
      });
      setCurrentResponse('');
      setCurrentImages([]);
    }
  };

  const copyModelId = (modelId: string) => {
    navigator.clipboard.writeText(modelId);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 标题 */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-3xl font-bold text-gray-900">My AI Studio</h1>
      </div>

      {/* 模型标签 */}
      <div className="px-6 py-4 border-b border-gray-200 flex gap-2 overflow-x-auto">
        {['featured', 'gemini', 'live', 'images', 'video', 'audio'].map((tab) => (
          <button
            key={tab}
            onClick={() => onSelectTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              selectedTab === tab
                ? 'bg-gray-200 text-gray-900'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab === 'featured' ? '精选' : tab === 'gemini' ? 'Gemini' : tab}
          </button>
        ))}
      </div>

      {/* 模型列表 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl space-y-4">
          {filteredModels.map((model) => (
            <div
              key={model.id}
              onClick={() => onSelectModel(model)}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                selectedModel?.id === model.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{model.name}</h3>
                    {model.isNew && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                        新
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{model.description}</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyModelId(model.id);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    title="复制模型ID"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    title="在新标签页打开"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 对话历史 */}
        <div className="mt-8 max-w-4xl space-y-6">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-4 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                  AI
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {message.content && (
                  <pre className="whitespace-pre-wrap text-sm font-sans mb-2">
                    {message.content}
                  </pre>
                )}
                {message.images && message.images.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {message.images.map((img, imgIndex) => (
                      <div key={imgIndex} className="rounded-lg overflow-hidden">
                        <img
                          src={img.data.startsWith('data:') ? img.data : `data:${img.mimeType};base64,${img.data}`}
                          alt={`图片 ${imgIndex + 1}`}
                          className="max-w-full h-auto rounded"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {message.role === 'user' && (
                <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                  我
                </div>
              )}
            </div>
          ))}
          
          {/* 当前正在生成的回复 */}
          {(currentResponse || currentImages.length > 0) && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                AI
              </div>
              <div className="max-w-[80%] rounded-lg p-4 bg-gray-100 text-gray-900">
                {currentResponse && (
                  <pre className="whitespace-pre-wrap text-sm font-sans mb-2">
                    {currentResponse}
                  </pre>
                )}
                {currentImages.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {currentImages.map((img, index) => (
                      <div key={index} className="rounded-lg overflow-hidden">
                        <img
                          src={`data:${img.mimeType};base64,${img.data}`}
                          alt={`生成的图片 ${index + 1}`}
                          className="max-w-full h-auto rounded"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {isStreaming && (
                  <span className="inline-block w-2 h-2 bg-blue-600 rounded-full animate-pulse ml-1"></span>
                )}
              </div>
            </div>
          )}
          <div ref={responseEndRef} />
        </div>
      </div>

      {/* 输入区域 */}
      <div className="p-6 border-t border-gray-200 bg-white">
        <form onSubmit={handleSubmit} className="max-w-4xl">
          {/* 图片预览 */}
          {images.length > 0 && (
            <div className="mb-4 flex gap-2 overflow-x-auto">
              {images.map((image, index) => (
                <div key={index} className="relative flex-shrink-0">
                  <img
                    src={URL.createObjectURL(image)}
                    alt={`预览 ${index + 1}`}
                    className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 输入框和按钮 */}
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
                  isDragActive
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input {...getInputProps()} />
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleSubmit();
                    }
                  }}
                  placeholder="输入提示词... (支持拖拽图片或点击上传)"
                  className="w-full resize-none border-none outline-none bg-transparent text-gray-900 placeholder-gray-400"
                  rows={3}
                />
                <div className="flex items-center justify-between mt-2">
                  <label className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors cursor-pointer">
                    <ImageIcon className="w-4 h-4" />
                    <span>上传图片</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) {
                          setImages((prev) => [...prev, ...Array.from(e.target.files || [])]);
                        }
                      }}
                    />
                  </label>
                  <span className="text-xs text-gray-400">
                    {isDragActive ? '松开以上传图片' : '支持拖拽图片'}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={!prompt.trim() || loading || isStreaming}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading || isStreaming ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>生成中...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>发送</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

