'use client';

import { X } from 'lucide-react';

interface Model {
  id: string;
  name: string;
  description: string;
}

interface SettingsPanelProps {
  model: Model | null;
  temperature: number;
  systemInstruction: string;
  includeThoughts: boolean;
  thinkingLevel: string;
  onTemperatureChange: (value: number) => void;
  onSystemInstructionChange: (value: string) => void;
  onIncludeThoughtsChange: (value: boolean) => void;
  onThinkingLevelChange: (value: string) => void;
  onClose: () => void;
}

export default function SettingsPanel({
  model,
  temperature,
  systemInstruction,
  includeThoughts,
  thinkingLevel,
  onTemperatureChange,
  onSystemInstructionChange,
  onIncludeThoughtsChange,
  onThinkingLevelChange,
  onClose,
}: SettingsPanelProps) {
  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-base md:text-lg font-semibold text-gray-900">运行设置</h2>
        <button
          onClick={onClose}
          className="p-2 md:p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5 md:w-4 md:h-4" />
        </button>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto p-4 md:p-4 space-y-4 md:space-y-6">
        {/* 模型信息 */}
        {model && (
          <div>
            <h3 className="text-sm md:text-sm font-semibold text-gray-900 mb-2">{model.name}</h3>
            <p className="text-xs text-gray-500 mb-1 break-all">{model.id}</p>
            <p className="text-xs md:text-sm text-gray-600">{model.description}</p>
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
            rows={6}
          />
        </div>

        {/* Temperature */}
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
            className="w-full h-2"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0</span>
            <span>2</span>
          </div>
        </div>

        {/* Thinking配置 */}
        <div className="border-t border-gray-200 pt-4 md:pt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">思考配置</h3>
          
          {/* 启用Thinking */}
          <div className="mb-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={includeThoughts}
                onChange={(e) => onIncludeThoughtsChange(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">启用思考过程输出</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              显示模型的内部推理过程，有助于理解模型的思考路径
            </p>
          </div>

          {/* Thinking Level */}
          {includeThoughts && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                思考级别
              </label>
              <select
                value={thinkingLevel}
                onChange={(e) => onThinkingLevelChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="low">低 (Low) - 快速响应</option>
                <option value="high">高 (High) - 深度思考</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {thinkingLevel === 'low' 
                  ? '快速响应，适合大多数场景' 
                  : '更深度的思考，可能需要更长时间'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

