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
  // 图片生成参数
  aspectRatio: string;
  imageSize: string;
  responseModalities: string[];
  onTemperatureChange: (value: number) => void;
  onSystemInstructionChange: (value: string) => void;
  onIncludeThoughtsChange: (value: boolean) => void;
  onThinkingLevelChange: (value: string) => void;
  onAspectRatioChange: (value: string) => void;
  onImageSizeChange: (value: string) => void;
  onResponseModalitiesChange: (value: string[]) => void;
  onClose: () => void;
}

export default function SettingsPanel({
  model,
  temperature,
  systemInstruction,
  includeThoughts,
  thinkingLevel,
  aspectRatio,
  imageSize,
  responseModalities,
  onTemperatureChange,
  onSystemInstructionChange,
  onIncludeThoughtsChange,
  onThinkingLevelChange,
  onAspectRatioChange,
  onImageSizeChange,
  onResponseModalitiesChange,
  onClose,
}: SettingsPanelProps) {
  // 检查是否是图片生成模型
  const isImageModel = model?.id?.includes('image') || model?.id === 'gemini-2.5-flash-image';
  const isGemini3ProImage = model?.id === 'gemini-3-pro-image-preview';
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

        {/* 图片生成配置 - 仅在图片模型时显示 */}
        {isImageModel && (
          <div className="border-t border-gray-200 pt-4 md:pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">图片生成配置</h3>
            
            {/* Aspect Ratio */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                宽高比 (Aspect Ratio)
              </label>
              <select
                value={aspectRatio}
                onChange={(e) => onAspectRatioChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="1:1">1:1 (正方形)</option>
                <option value="2:3">2:3 (竖屏)</option>
                <option value="3:2">3:2 (横屏)</option>
                <option value="3:4">3:4 (竖屏)</option>
                <option value="4:3">4:3 (横屏)</option>
                <option value="4:5">4:5 (竖屏)</option>
                <option value="5:4">5:4 (横屏)</option>
                <option value="9:16">9:16 (手机竖屏)</option>
                <option value="16:9">16:9 (宽屏)</option>
                <option value="21:9">21:9 (超宽屏)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                控制生成图片的宽高比例
              </p>
            </div>

            {/* Image Size - 仅 Gemini 3 Pro Image 支持 */}
            {isGemini3ProImage && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  图片分辨率 (Image Size)
                </label>
                <select
                  value={imageSize}
                  onChange={(e) => onImageSizeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="1K">1K (标准)</option>
                  <option value="2K">2K (高清)</option>
                  <option value="4K">4K (超高清)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  仅 Gemini 3 Pro Image 支持，分辨率越高生成时间越长
                </p>
              </div>
            )}

            {/* Response Modalities */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                响应类型 (Response Modalities)
              </label>
              <div className="space-y-2">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={responseModalities.includes('TEXT')}
                    onChange={(e) => {
                      const newModalities = e.target.checked
                        ? [...responseModalities.filter(m => m !== 'TEXT'), 'TEXT']
                        : responseModalities.filter(m => m !== 'TEXT');
                      onResponseModalitiesChange(newModalities.length > 0 ? newModalities : ['IMAGE']);
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">文本 (TEXT)</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={responseModalities.includes('IMAGE')}
                    onChange={(e) => {
                      const newModalities = e.target.checked
                        ? [...responseModalities.filter(m => m !== 'IMAGE'), 'IMAGE']
                        : responseModalities.filter(m => m !== 'IMAGE');
                      onResponseModalitiesChange(newModalities.length > 0 ? newModalities : ['TEXT']);
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">图片 (IMAGE)</span>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                选择模型返回的内容类型，至少选择一种
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

