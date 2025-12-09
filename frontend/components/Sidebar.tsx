'use client';

import { useState } from 'react';
import { Home, Play, Wrench, BarChart, BookOpen, Settings, LogOut, ChevronDown, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  email: string;
  name: string;
}

interface SidebarProps {
  user: User | null;
}

export default function Sidebar({ user }: SidebarProps) {
  const router = useRouter();
  const [playgroundExpanded, setPlaygroundExpanded] = useState(true);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen">
      {/* Logo */}
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-800">My AI Studio</h1>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          <a
            href="#"
            className="flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Home className="w-5 h-5" />
            <span>首页</span>
          </a>

          <div>
            <button
              onClick={() => setPlaygroundExpanded(!playgroundExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <Play className="w-5 h-5" />
                <span className="font-medium">Playground</span>
              </div>
              {playgroundExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {playgroundExpanded && (
              <div className="ml-8 mt-1 space-y-1">
                <a
                  href="#"
                  className="block px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  员工绩效评估...
                </a>
                <a
                  href="#"
                  className="block px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  绘制正弦函数图
                </a>
                <a
                  href="#"
                  className="block px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  小米股价反弹区间与节点
                </a>
                <a
                  href="#"
                  className="block px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  查看全部历史
                </a>
              </div>
            )}
          </div>

          <a
            href="#"
            className="flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Wrench className="w-5 h-5" />
            <span>构建</span>
            <ChevronRight className="w-4 h-4 ml-auto" />
          </a>

          <a
            href="#"
            className="flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <BarChart className="w-5 h-5" />
            <span>仪表板</span>
            <ChevronRight className="w-4 h-4 ml-auto" />
          </a>

          <a
            href="#"
            className="flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <BookOpen className="w-5 h-5" />
            <span>文档</span>
            <ChevronRight className="w-4 h-4 ml-auto" />
          </a>
        </div>
      </nav>

      {/* 底部信息 */}
      <div className="p-4 border-t border-gray-200 space-y-4">
        <p className="text-xs text-gray-500">
          Google AI模型可能会出错，请仔细检查输出。
        </p>

        <div className="space-y-2">
          <a
            href="#"
            className="block text-sm text-blue-600 hover:text-blue-700"
          >
            获取API密钥
          </a>
          <button
            onClick={() => {}}
            className="block text-sm text-gray-600 hover:text-gray-700"
          >
            <Settings className="inline-block w-4 h-4 mr-1" />
            设置
          </button>
        </div>

        {user && (
          <div className="pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
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
    </div>
  );
}

