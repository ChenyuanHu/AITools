'use client';

import { useState, useEffect } from 'react';
import { Plus, MessageSquare, Trash2, LogOut, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  name: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  images?: Array<{ data: string; mimeType: string }>;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

interface SidebarProps {
  user: User | null;
  currentConversationId: string | null;
  conversations: Conversation[];
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onClose?: () => void; // 移动端关闭回调
}

const STORAGE_KEY = 'ai_conversations';
const MAX_CONVERSATIONS = 50; // 最多保留50个会话
const MAX_STORAGE_SIZE = 4 * 1024 * 1024; // 4MB 限制（留出安全余量）

// 计算数据大小（字节）
function getStorageSize(data: string): number {
  return new Blob([data]).size;
}

// 清理旧会话，保留最新的
function trimConversations(conversations: Conversation[]): Conversation[] {
  // 按更新时间排序，保留最新的
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  return sorted.slice(0, MAX_CONVERSATIONS);
}

// 移除图片数据以减小存储大小（仅在必要时使用）
function compressConversation(conversation: Conversation, removeImages: boolean = false): Conversation {
  if (!removeImages) {
    return conversation;
  }
  
  return {
    ...conversation,
    messages: conversation.messages.map(msg => ({
      ...msg,
      // 移除图片数据，只保留图片数量信息
      images: msg.images ? msg.images.map((img, index) => ({
        mimeType: img.mimeType,
        // 不存储图片数据，只存储占位符
        data: `[图片${index + 1}数据已移除]`
      })) : undefined
    }))
  };
}

export function loadConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('加载会话失败:', error);
    return [];
  }
}

export function saveConversations(conversations: Conversation[]) {
  if (typeof window === 'undefined') return;
  
  try {
    // 先清理旧会话
    let trimmedConversations = trimConversations(conversations);
    
    // 尝试保存
    const dataString = JSON.stringify(trimmedConversations);
    const dataSize = getStorageSize(dataString);
    
    // 如果数据太大，先尝试减少会话数量（保留图片数据）
    if (dataSize > MAX_STORAGE_SIZE) {
      console.warn('会话数据过大，减少会话数量...');
      trimmedConversations = trimmedConversations.slice(0, Math.floor(MAX_CONVERSATIONS * 0.7));
      const reducedString = JSON.stringify(trimmedConversations);
      const reducedSize = getStorageSize(reducedString);
      
      // 如果减少会话数量后还是太大，再尝试压缩图片数据
      if (reducedSize > MAX_STORAGE_SIZE) {
        console.warn('减少会话数量后数据仍然过大，压缩图片数据...');
        trimmedConversations = trimmedConversations.map(conv => compressConversation(conv, true));
      }
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedConversations));
    
    // 如果删除了会话，提示用户
    if (trimmedConversations.length < conversations.length) {
      console.warn(`已自动清理 ${conversations.length - trimmedConversations.length} 个旧会话以节省存储空间`);
    }
  } catch (error: any) {
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      console.error('存储空间不足，尝试清理旧数据...');
      
      // 尝试清理更多旧会话（先不压缩图片）
      try {
        let trimmedConversations = trimConversations(conversations);
        // 只保留最新的 30 个会话（保留图片数据）
        trimmedConversations = trimmedConversations.slice(0, 30);
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedConversations));
        console.warn('已清理部分旧会话以释放存储空间');
      } catch (retryError) {
        console.error('无法保存会话数据，尝试压缩图片数据...', retryError);
        // 第二次尝试：减少会话数量并压缩图片数据
        try {
          let trimmedConversations = trimConversations(conversations);
          // 只保留最新的 20 个会话
          trimmedConversations = trimmedConversations.slice(0, 20);
          // 压缩图片数据
          trimmedConversations = trimmedConversations.map(conv => compressConversation(conv, true));
          
          localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedConversations));
          console.warn('已清理部分旧会话并压缩图片数据');
        } catch (secondRetryError) {
          console.error('仍然无法保存，尝试只保留少量会话:', secondRetryError);
          // 最后的尝试：只保留最新的 10 个会话（压缩图片）
          try {
            const lastConversations = conversations
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .slice(0, 10)
              .map(conv => compressConversation(conv, true));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(lastConversations));
            console.warn('已清理大部分会话，仅保留最新的 10 个会话（图片数据已压缩）');
          } catch (finalError) {
            console.error('存储空间严重不足，无法保存会话数据:', finalError);
            // 最后的最后：清空所有数据并重新开始
            try {
              localStorage.removeItem(STORAGE_KEY);
              console.warn('已清空所有会话数据，请重新开始');
            } catch (clearError) {
              console.error('无法清空存储，可能需要用户手动清理浏览器缓存');
            }
          }
        }
      }
    } else {
      console.error('保存会话失败:', error);
    }
  }
}

export function createConversation(title: string = '新会话'): Conversation {
  return {
    id: Date.now().toString(),
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
}

export default function Sidebar({
  user,
  currentConversationId,
  conversations,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onClose,
}: SidebarProps) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这个会话吗？')) {
      onDeleteConversation(id);
    }
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen">
      {/* Logo 和关闭按钮 */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">My AI Studio</h1>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 新建会话按钮 */}
      <div className="p-3 md:p-4 border-b border-gray-200">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 md:py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm md:text-base"
        >
          <Plus className="w-4 h-4" />
          <span>新建会话</span>
        </button>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>还没有会话</p>
              <p className="text-xs mt-1">点击&ldquo;新建会话&rdquo;开始</p>
            </div>
          ) : (
            conversations
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation.id)}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                    currentConversationId === conversation.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{conversation.title}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(conversation.updatedAt).toLocaleDateString('zh-CN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(conversation.id, e)}
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition-all"
                    title="删除会话"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
          )}
        </div>
      </div>

      {/* 底部用户信息 */}
      {user && (
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{user.name}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title="退出登录"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
