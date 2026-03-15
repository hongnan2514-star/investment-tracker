'use client';

import React from 'react';
import { ArrowLeft, Banknote } from 'lucide-react';

interface IconItem {
  name: string;
  file: string;
}

interface IconSelectorProps {
  icons: IconItem[];
  onSelect: (iconFile: string) => void;
  onClose: () => void;
}

export default function IconSelector({ icons, onSelect, onClose }: IconSelectorProps) {
  return (
    <div className="fixed inset-0 bg-white dark:bg-black z-50 flex flex-col">
      {/* 头部：只有返回按钮（带灰色圆框） */}
      <div className="flex items-center p-4">
        <button
          onClick={onClose}
          className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
        </button>
      </div>

      {/* 可滚动内容区 */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {/* 默认图标行 - 左右布局，灰色背景框 */}
        <button
          onClick={() => {
            onSelect('');
            onClose();
          }}
          className="w-full flex items-center justify-between p-4 mb-6 bg-gray-200 dark:bg-gray-800 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          <span className="text-base font-medium text-gray-900 dark:text-gray-100">默认</span>
          <Banknote size={24} className="text-gray-600 dark:text-gray-300" />
        </button>

        {/* 网络账户分组标题 */}
        <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 ml-1">
          网络账户
        </div>

        {/* 银行图标大背景框 */}
        <div className="bg-gray-200 dark:bg-gray-800 rounded-xl p-4">
          <div className="grid grid-cols-4 gap-4">
            {icons.map(icon => (
              <button
                key={icon.name}
                onClick={() => {
                  onSelect(icon.file);
                  onClose();
                }}
                className="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                <img
                  src={`/icons/payment/${icon.file}`}
                  alt={icon.name}
                  className="w-8 h-8 object-contain rounded-lg"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300 text-center">{icon.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}