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
    images?: Array<{ data: string; mimeType: string; thoughtSignature?: string }>;
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

// 使用 IndexedDB 存储会话数据
import { 
  loadConversations as loadFromIndexedDB, 
  saveConversations as saveToIndexedDB,
  removeConversation as removeFromIndexedDB
} from '@/lib/indexedDB';

// 导出函数，使用 IndexedDB
export async function loadConversations(): Promise<Conversation[]> {
  if (typeof window === 'undefined') return [];
  
  try {
    return await loadFromIndexedDB();
  } catch (error) {
    console.error('加载会话失败:', error);
    return [];
  }
}

export async function saveConversations(conversations: Conversation[]): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    await saveToIndexedDB(conversations);
  } catch (error) {
    console.error('保存会话失败:', error);
    throw error;
  }
}

export async function removeConversation(id: string): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    await removeFromIndexedDB(id);
  } catch (error) {
    console.error('删除会话失败:', error);
    throw error;
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
            [...conversations]
              .sort((a, b) => {
                // 确保 updatedAt 存在，如果不存在则使用 createdAt
                const aTime = a.updatedAt || a.createdAt || 0;
                const bTime = b.updatedAt || b.createdAt || 0;
                return bTime - aTime; // 降序：最新的在前
              })
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
