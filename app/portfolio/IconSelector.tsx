'use client';

import React from 'react';
import { ArrowLeft, Banknote } from 'lucide-react';

interface IconItem {
  name: string;
  file: string;
}

interface IconGroup {
  title: string;
  icons: IconItem[];
}

interface IconSelectorProps {
  groups: IconGroup[];
  onSelect: (iconFile: string) => void;
  onClose: () => void;
}

export default function IconSelector({ groups, onSelect, onClose }: IconSelectorProps) {
  return (
    <div className="fixed inset-0 bg-white dark:bg-black z-50 flex flex-col">
      {/* 头部：只有返回按钮（带灰色圆框） */}
      <div className="flex items-center p-4">
        <button
          onClick={onClose}
          className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
        </button>
      </div>

      {/* 可滚动内容区 */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {/* 默认图标行 - 始终存在 */}
        <button
          onClick={() => {
            onSelect('');
            onClose();
          }}
          className="w-full flex items-center justify-between p-4 mb-6 bg-gray-200 dark:bg-gray-700 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="text-base font-medium text-gray-700 dark:text-gray-300">默认</span>
          <Banknote size={24} className="text-gray-600 dark:text-gray-300" />
        </button>

        {/* 循环渲染每个分组 */}
        {groups.map((group) => (
          <React.Fragment key={group.title}>
            {/* 分组标题 */}
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-400 mb-2 ml-1">
              {group.title}
            </div>

            {/* 图标大背景框 */}
            <div className="bg-gray-200 dark:bg-gray-700 rounded-xl p-4 mb-6">
              <div className="grid grid-cols-4 gap-4">
                {group.icons.map(icon => (
                  <button
                    key={icon.name}
                    onClick={() => {
                      onSelect(icon.file);
                      onClose();
                    }}
                    className="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-800 transition-colors"
                  >
                    <img
                      src={`/icons/payment/${icon.file}`}
                      alt={icon.name}
                      className="w-10 h-10 object-contain rounded-lg"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300 text-center">
                      {icon.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}