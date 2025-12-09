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
  onTemperatureChange: (value: number) => void;
  onSystemInstructionChange: (value: string) => void;
  onClose: () => void;
}

export default function SettingsPanel({
  model,
  temperature,
  systemInstruction,
  onTemperatureChange,
  onSystemInstructionChange,
  onClose,
}: SettingsPanelProps) {
  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">运行设置</h2>
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
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0</span>
            <span>2</span>
          </div>
        </div>
      </div>
    </div>
  );
}

