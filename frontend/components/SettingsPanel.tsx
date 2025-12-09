'use client';

import { X, Edit } from 'lucide-react';

interface Model {
  id: string;
  name: string;
  description: string;
}

interface SettingsPanelProps {
  model: Model | null;
  temperature: number;
  systemInstruction: string;
  outputLength: number;
  topP: number;
  grounding: boolean;
  urlContext: boolean;
  onTemperatureChange: (value: number) => void;
  onSystemInstructionChange: (value: string) => void;
  onOutputLengthChange: (value: number) => void;
  onTopPChange: (value: number) => void;
  onGroundingChange: (value: boolean) => void;
  onUrlContextChange: (value: boolean) => void;
  onClose: () => void;
}

export default function SettingsPanel({
  model,
  temperature,
  systemInstruction,
  outputLength,
  topP,
  grounding,
  urlContext,
  onTemperatureChange,
  onSystemInstructionChange,
  onOutputLengthChange,
  onTopPChange,
  onGroundingChange,
  onUrlContextChange,
  onClose,
}: SettingsPanelProps) {
  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex gap-2">
          <button className="px-3 py-1 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
            运行设置
          </button>
          <button className="px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-900">
            获取代码
          </button>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* 模型信息 */}
        {model && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">{model.name}</h3>
            <p className="text-xs text-gray-500 mb-1">{model.id}</p>
            <p className="text-sm text-gray-600">{model.description}</p>
          </div>
        )}

        {/* 系统指令 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            系统指令
          </label>
          <textarea
            value={systemInstruction}
            onChange={(e) => onSystemInstructionChange(e.target.value)}
            placeholder="可选的模型音调和风格指令"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={4}
          />
        </div>

        {/* 模型配置 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Temperature: {temperature}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0</span>
              <span>2</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              媒体分辨率
            </label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option>默认</option>
              <option>高</option>
              <option>低</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              思考级别
            </label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option>高</option>
              <option>中</option>
              <option>低</option>
            </select>
          </div>
        </div>

        {/* 工具 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">工具</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">结构化输出</label>
                <p className="text-xs text-gray-500">定义输出格式</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="text-xs text-blue-600 hover:text-blue-700">
                  <Edit className="w-4 h-4" />
                </button>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">代码执行</label>
                <p className="text-xs text-gray-500">允许模型执行代码</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">函数调用</label>
                <p className="text-xs text-gray-500">启用函数调用</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="text-xs text-blue-600 hover:text-blue-700">
                  <Edit className="w-4 h-4" />
                </button>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">使用Google搜索进行基础验证</label>
                <p className="text-xs text-gray-500">增强回答的准确性</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={grounding}
                  onChange={(e) => onGroundingChange(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">URL上下文</label>
                <p className="text-xs text-gray-500">从URL加载内容</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={urlContext}
                  onChange={(e) => onUrlContextChange(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* 高级设置 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">高级设置</h3>
          <div className="space-y-4">
            <div>
              <button className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-left hover:bg-gray-50 transition-colors flex items-center justify-between">
                <span>安全设置</span>
                <Edit className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div>
              <button className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-left hover:bg-gray-50 transition-colors">
                添加停止序列
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                输出长度
              </label>
              <input
                type="number"
                value={outputLength}
                onChange={(e) => onOutputLengthChange(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Top P: {topP}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={topP}
                onChange={(e) => onTopPChange(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0</span>
                <span>1</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="p-4 border-t border-gray-200 flex gap-2">
        <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
          运行
        </button>
        <button className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled>
          停止
        </button>
        <button className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          重置
        </button>
      </div>
    </div>
  );
}

