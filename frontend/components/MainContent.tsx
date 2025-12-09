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

interface MainContentProps {
  models: Model[];
  selectedModel: Model | null;
  selectedTab: string;
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
}

export default function MainContent({
  models,
  selectedModel,
  selectedTab,
  onSelectModel,
  onSelectTab,
  onGenerate,
  onGenerateStream,
  loading,
}: MainContentProps) {
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [response, setResponse] = useState('');
  const [generatedImages, setGeneratedImages] = useState<Array<{ data: string; mimeType: string }>>([]);
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

    setResponse('');
    setGeneratedImages([]);
    setIsStreaming(true);

    try {
      let fullResponse = '';
      await onGenerateStream(
        prompt,
        images,
        (chunk) => {
          fullResponse += chunk;
          setResponse(fullResponse);
          // 自动滚动到底部
          setTimeout(() => {
            responseEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 0);
        },
        (image) => {
          console.log('[前端] MainContent 收到图片:', {
            mimeType: image.mimeType,
            dataLength: image.data?.length || 0,
            dataPreview: image.data?.substring(0, 50) + '...'
          });
          // 验证图片数据格式
          if (!image.data || !image.mimeType) {
            console.error('[前端] 图片数据格式不正确:', image);
            return;
          }
          // 添加生成的图片
          setGeneratedImages((prev) => {
            const newImages = [...prev, image];
            console.log('[前端] 更新图片列表，当前数量:', newImages.length);
            return newImages;
          });
          // 自动滚动到底部
          setTimeout(() => {
            responseEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 0);
        },
        () => {
          setIsStreaming(false);
        }
      );
    } catch (error: any) {
      setResponse(`错误: ${error.message}`);
      setIsStreaming(false);
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

        {/* 响应区域 */}
        {(response || generatedImages.length > 0) && (
          <div className="mt-8 max-w-4xl">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="prose max-w-none">
                {response && (
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                    {response}
                  </pre>
                )}
                {generatedImages.length > 0 && (
                  <div className="mt-4 space-y-4">
                    {generatedImages.map((img, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                        <img
                          src={`data:${img.mimeType};base64,${img.data}`}
                          alt={`生成的图片 ${index + 1}`}
                          className="w-full h-auto"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div ref={responseEndRef} />
              </div>
            </div>
          </div>
        )}
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

