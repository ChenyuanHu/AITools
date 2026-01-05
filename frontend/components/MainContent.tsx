'use client';

import { useState, useRef } from 'react';
import { Copy, ExternalLink, Send, Image as ImageIcon, X, Edit2, Check, X as XIcon } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import MarkdownRenderer from './MarkdownRenderer';

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
  images?: Array<{ data: string; mimeType: string; thoughtSignature?: string }>;
  thinking?: string; // thinking内容（思考过程）
}

interface MainContentProps {
  models: Model[];
  selectedModel: Model | null;
  selectedTab: string;
  messages: Message[];
  onSelectModel: (model: Model) => void;
  onSelectTab: (tab: string) => void;
  onGenerate: (prompt: string, images: File[], history: Message[]) => Promise<any>;
  onGenerateStream: (
    prompt: string,
    images: File[],
    history: Message[],
    onChunk: (text: string) => void,
    onImage?: (image: { data: string; mimeType: string; thoughtSignature?: string }) => void,
    onComplete?: () => void,
    onThinking?: (thinking: string) => void // 新增thinking回调
  ) => Promise<void>;
  loading: boolean;
  onMessageSent: (message: Message) => void;
  onEditMessage?: (messageIndex: number, newContent: string, newImages?: File[]) => void; // 编辑消息回调
  onTruncateMessages?: (keepUntilIndex: number) => void; // 截断消息回调
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
  onEditMessage,
  onTruncateMessages,
}: MainContentProps) {
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [currentThinking, setCurrentThinking] = useState(''); // thinking内容状态
  const [currentImages, setCurrentImages] = useState<Array<{ data: string; mimeType: string; thoughtSignature?: string }>>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null); // 正在编辑的消息索引
  const [editingContent, setEditingContent] = useState(''); // 编辑中的内容
  const [editingImages, setEditingImages] = useState<File[]>([]); // 编辑中的图片

  // 将 base64 图片转换为 File 对象
  const base64ToFile = async (base64Data: string, mimeType: string, filename: string = 'image'): Promise<File> => {
    // 确保 base64 数据格式正确
    const base64 = base64Data.startsWith('data:') 
      ? base64Data.split(',')[1] 
      : base64Data;
    
    // 将 base64 转换为 Blob
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    
    // 从 Blob 创建 File 对象
    return new File([blob], filename, { type: mimeType });
  };
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
    setCurrentThinking(''); // 清空thinking
    setCurrentImages([]);
    setIsStreaming(true);

    try {
      let fullResponse = '';
      let fullThinking = ''; // 累积所有thinking内容
      const responseImages: Array<{ data: string; mimeType: string; thoughtSignature?: string }> = [];
      
      await onGenerateStream(
        userPrompt,
        userImages,
        messages, // 传递历史消息
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
            hasThoughtSignature: !!image.thoughtSignature,
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
          // 注意：即使只有thinking内容，也应该保存（可能没有正文内容）
          // 使用累积的fullThinking，而不是currentThinking状态（因为状态更新可能有延迟）
          if (fullResponse || responseImages.length > 0 || fullThinking) {
            const messageToSave = {
              role: 'assistant' as const,
              content: fullResponse || '', // 确保content不为undefined
              images: responseImages.length > 0 ? responseImages : undefined,
              thinking: fullThinking && fullThinking.trim() ? fullThinking : undefined, // 保存thinking内容（只保存非空的）
            };
            console.log('[MainContent] 保存消息:', {
              hasContent: !!messageToSave.content,
              contentLength: messageToSave.content.length,
              hasThinking: !!messageToSave.thinking,
              thinkingLength: messageToSave.thinking?.length || 0,
              thinkingPreview: messageToSave.thinking?.substring(0, 100),
            });
            onMessageSent(messageToSave);
          }
          // 延迟清空，确保消息已保存
          setTimeout(() => {
            setCurrentResponse('');
            setCurrentThinking('');
            setCurrentImages([]);
          }, 100);
        },
        // onThinking回调
        (thinking: string) => {
          fullThinking += thinking; // 累积到局部变量
          setCurrentThinking((prev) => prev + thinking); // 同时更新状态用于显示
          // 自动滚动到底部
          setTimeout(() => {
            responseEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 0);
        }
      );
    } catch (error: any) {
      setIsStreaming(false);
      // 显示详细的错误信息
      const errorMessage = error.message || '生成失败';
      console.error('[MainContent] 生成错误:', error);
      
      // 构建详细的错误消息
      let errorContent = `❌ **错误**: ${errorMessage}`;
      if (error.details) {
        errorContent += `\n\n\`\`\`\n${error.details}\n\`\`\``;
      }
      
      onMessageSent({
        role: 'assistant',
        content: errorContent,
      });
      setCurrentResponse('');
      setCurrentImages([]);
      setCurrentThinking('');
    }
  };

  const copyModelId = (modelId: string) => {
    navigator.clipboard.writeText(modelId);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 标题 - 桌面端 */}
      <div className="hidden md:block p-6 border-b border-gray-200">
        <h1 className="text-3xl font-bold text-gray-900">My AI Studio</h1>
      </div>

      {/* 模型列表 */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        <div className="max-w-4xl mx-auto space-y-3 md:space-y-4">
          {filteredModels.map((model) => (
            <div
              key={model.id}
              onClick={() => onSelectModel(model)}
              className={`p-3 md:p-4 border rounded-lg cursor-pointer transition-all ${
                selectedModel?.id === model.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-gray-900 text-sm md:text-base">{model.name}</h3>
                    {model.isNew && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                        新
                      </span>
                    )}
                  </div>
                  <p className="text-xs md:text-sm text-gray-600">{model.description}</p>
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
        <div className="mt-4 md:mt-8 max-w-4xl mx-auto space-y-4 md:space-y-6">
          {messages.map((message, index) => {
            const isEditing = editingIndex === index && message.role === 'user';
            
            return (
            <div
              key={index}
              className={`flex gap-2 md:gap-4 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="w-7 h-7 md:w-8 md:h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs md:text-sm font-medium flex-shrink-0">
                  AI
                </div>
              )}
              <div
                className={`max-w-[85%] md:max-w-[80%] rounded-lg p-3 md:p-4 relative group ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {/* 用户消息的编辑按钮 */}
                {message.role === 'user' && !isEditing && (
                  <button
                    onClick={async () => {
                      setEditingIndex(index);
                      setEditingContent(message.content);
                      
                      // 将原始消息中的 base64 图片转换为 File 对象
                      if (message.images && message.images.length > 0) {
                        const filePromises = message.images.map((img, imgIndex) => {
                          const imageData = img.data.startsWith('data:') 
                            ? img.data.split(',')[1] 
                            : img.data;
                          return base64ToFile(
                            imageData, 
                            img.mimeType, 
                            `image-${imgIndex + 1}.${img.mimeType.split('/')[1] || 'png'}`
                          );
                        });
                        const files = await Promise.all(filePromises);
                        setEditingImages(files);
                      } else {
                        setEditingImages([]);
                      }
                    }}
                    className="absolute -left-8 md:-left-10 top-2 p-1 text-gray-400 hover:text-blue-600 bg-white rounded shadow-sm transition-colors"
                    title="编辑消息"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                
                {/* 编辑模式 */}
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded text-gray-900 text-sm md:text-base resize-none"
                      rows={3}
                      autoFocus
                    />
                    {/* 图片预览（如果有） */}
                    {message.images && message.images.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {message.images.map((img, imgIndex) => (
                          <div key={imgIndex} className="relative flex-shrink-0">
                            <img
                              src={img.data.startsWith('data:') ? img.data : `data:${img.mimeType};base64,${img.data}`}
                              alt={`图片 ${imgIndex + 1}`}
                              className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg border border-gray-200"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => {
                          setEditingIndex(null);
                          setEditingContent('');
                          setEditingImages([]);
                        }}
                        className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors flex items-center gap-1"
                      >
                        <XIcon className="w-4 h-4" />
                        取消
                      </button>
                      <button
                        onClick={async () => {
                          if (!editingContent.trim()) return;
                          
                          // 截断消息：删除编辑这一轮次之后的所有消息
                          if (onTruncateMessages) {
                            onTruncateMessages(index);
                          }
                          
                          // 更新消息内容
                          if (onEditMessage) {
                            await onEditMessage(index, editingContent.trim(), editingImages.length > 0 ? editingImages : undefined);
                          }
                          
                          // 重新发送
                          setEditingIndex(null);
                          setEditingContent('');
                          setEditingImages([]);
                          
                          // 准备发送
                          const userPrompt = editingContent.trim();
                          const userImages = editingImages.length > 0 ? editingImages : [];
                          
                          // 将图片转换为 base64
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
                          
                          // 更新用户消息（如果 onEditMessage 没有处理）
                          if (!onEditMessage) {
                            onMessageSent({
                              role: 'user',
                              content: userPrompt,
                              images: imageData.length > 0 ? imageData : undefined,
                            });
                          }
                          
                          // 清空输入
                          setCurrentResponse('');
                          setCurrentThinking('');
                          setCurrentImages([]);
                          setIsStreaming(true);
                          
                          try {
                            let fullResponse = '';
                            let fullThinking = '';
                            const responseImages: Array<{ data: string; mimeType: string; thoughtSignature?: string }> = [];
                            
                            // 获取截断后的历史消息
                            const truncatedMessages = messages.slice(0, index);
                            
                            await onGenerateStream(
                              userPrompt,
                              userImages,
                              truncatedMessages,
                              (chunk) => {
                                fullResponse += chunk;
                                setCurrentResponse(fullResponse);
                                setTimeout(() => {
                                  responseEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                                }, 0);
                              },
                              (image) => {
                                console.log('[前端] MainContent 收到图片（编辑模式）:', {
                                  mimeType: image.mimeType,
                                  dataLength: image.data?.length || 0,
                                  hasThoughtSignature: !!image.thoughtSignature,
                                });
                                if (!image.data || !image.mimeType) return;
                                responseImages.push(image);
                                setCurrentImages([...responseImages]);
                                setTimeout(() => {
                                  responseEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                                }, 0);
                              },
                              () => {
                                setIsStreaming(false);
                                if (fullResponse || responseImages.length > 0 || fullThinking) {
                                  onMessageSent({
                                    role: 'assistant' as const,
                                    content: fullResponse || '',
                                    images: responseImages.length > 0 ? responseImages : undefined,
                                    thinking: fullThinking && fullThinking.trim() ? fullThinking : undefined,
                                  });
                                }
                                setTimeout(() => {
                                  setCurrentResponse('');
                                  setCurrentThinking('');
                                  setCurrentImages([]);
                                }, 100);
                              },
                              (thinking: string) => {
                                fullThinking += thinking;
                                setCurrentThinking((prev) => prev + thinking);
                                setTimeout(() => {
                                  responseEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                                }, 0);
                              }
                            );
                          } catch (error: any) {
                            setIsStreaming(false);
                            // 显示详细的错误信息
                            const errorMessage = error.message || '生成失败';
                            console.error('[MainContent] 生成错误（编辑模式）:', error);
                            
                            // 构建详细的错误消息
                            let errorContent = `❌ **错误**: ${errorMessage}`;
                            if (error.details) {
                              errorContent += `\n\n\`\`\`\n${error.details}\n\`\`\``;
                            }
                            
                            onMessageSent({
                              role: 'assistant',
                              content: errorContent,
                            });
                            setCurrentResponse('');
                            setCurrentImages([]);
                            setCurrentThinking('');
                          }
                        }}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                      >
                        <Check className="w-4 h-4" />
                        重新发送
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 显示thinking内容 - 使用更明显的样式区分 */}
                    {message.thinking && message.thinking.trim() && (
                      <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-l-4 border-purple-400 rounded-r-lg shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-purple-600 font-bold text-sm">💭</span>
                          <span className="text-purple-700 font-semibold text-sm">思考过程</span>
                        </div>
                        {/* 使用Markdown渲染thinking内容 */}
                        <div className="text-purple-800 text-xs md:text-sm leading-relaxed break-words bg-white/50 p-2 rounded border border-purple-200">
                          <MarkdownRenderer content={message.thinking} />
                        </div>
                      </div>
                    )}
                    {/* 使用Markdown渲染正文内容 */}
                    {message.content && (
                      <div className={`text-xs md:text-sm prose prose-sm max-w-none ${
                        message.role === 'user' ? 'text-white' : 'text-gray-900'
                      }`}>
                        <MarkdownRenderer content={message.content} />
                      </div>
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
                  </>
                )}
              </div>
              {message.role === 'user' && (
                <div className="w-7 h-7 md:w-8 md:h-8 bg-gray-400 rounded-full flex items-center justify-center text-white text-xs md:text-sm font-medium flex-shrink-0">
                  我
                </div>
              )}
            </div>
          )})}
          
          {/* 当前正在生成的回复 */}
          {(currentResponse || currentThinking || currentImages.length > 0) && (
            <div className="flex gap-2 md:gap-4 justify-start">
              <div className="w-7 h-7 md:w-8 md:h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs md:text-sm font-medium flex-shrink-0">
                AI
              </div>
              <div className="max-w-[85%] md:max-w-[80%] rounded-lg p-3 md:p-4 bg-gray-100 text-gray-900">
                {/* 显示thinking内容 - 使用更明显的样式区分，确保始终显示在正文之前 */}
                {currentThinking && currentThinking.trim() && (
                  <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-l-4 border-purple-400 rounded-r-lg shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-purple-600 font-bold text-sm">💭</span>
                      <span className="text-purple-700 font-semibold text-sm">思考过程</span>
                    </div>
                    {/* 使用Markdown渲染thinking内容 */}
                    <div className="text-purple-800 text-xs md:text-sm leading-relaxed break-words bg-white/50 p-2 rounded border border-purple-200">
                      <MarkdownRenderer content={currentThinking} />
                    </div>
                  </div>
                )}
                {/* 使用Markdown渲染正文内容 - 只在有content时显示 */}
                {currentResponse && currentResponse.trim() && (
                  <div className="text-xs md:text-sm text-gray-900 prose prose-sm max-w-none">
                    <MarkdownRenderer content={currentResponse} />
                  </div>
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
      <div className="p-3 md:p-6 border-t border-gray-200 bg-white">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          {/* 图片预览 */}
          {images.length > 0 && (
            <div className="mb-3 md:mb-4 flex gap-2 overflow-x-auto pb-2">
              {images.map((image, index) => (
                <div key={index} className="relative flex-shrink-0">
                  <img
                    src={URL.createObjectURL(image)}
                    alt={`预览 ${index + 1}`}
                    className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute -top-1 -right-1 md:-top-2 md:-right-2 w-5 h-5 md:w-6 md:h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X className="w-3 h-3 md:w-4 md:h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 输入框和按钮 */}
          <div className="flex flex-col md:flex-row items-end gap-2 md:gap-2">
            <div className="flex-1 w-full relative">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-3 md:p-4 transition-colors ${
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
                  className="w-full resize-none border-none outline-none bg-transparent text-gray-900 placeholder-gray-400 text-sm md:text-base"
                  rows={3}
                />
                <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                  <label className="flex items-center gap-2 text-xs md:text-sm text-gray-600 hover:text-gray-800 transition-colors cursor-pointer">
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
                  <span className="text-xs text-gray-400 hidden md:inline">
                    {isDragActive ? '松开以上传图片' : '支持拖拽图片'}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={!prompt.trim() || loading || isStreaming}
              className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base"
            >
              {loading || isStreaming ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>生成中...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span className="hidden md:inline">发送</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

