// app/portfolio/IconSelector.tsx
'use client';

import React from 'react';
import { ArrowLeft, Banknote } from 'lucide-react';
import { useTheme } from '@/app/ThemeProvider';

interface IconItem {
  key: string;
  name: string;
  lightFile: string;
  darkFile: string;
  file?: string; // 可选，用于向后兼容
}

interface IconGroup {
  title: string;
  icons: IconItem[];
}

interface IconSelectorProps {
  groups: IconGroup[];
  onSelect: (iconKey: string) => void;
  onClose: () => void;
}

export default function IconSelector({ groups, onSelect, onClose }: IconSelectorProps) {
  const { theme } = useTheme();

  return (
    <div className="fixed inset-0 bg-gray-100 dark:bg-black z-50 flex flex-col">
      <div className="flex items-center p-4">
        <button
          onClick={onClose}
          className="p-2 bg-gray-200 dark:bg-neutral-900 rounded-full hover:bg-gray-300 dark:hover:bg-neutral-800 transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <button
          onClick={() => {
            onSelect('');
            onClose();
          }}
          className="w-full flex items-center justify-between p-4 mb-6 bg-white dark:bg-neutral-900 rounded-3xl hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <span className="text-base font-medium text-gray-700 dark:text-gray-300">默认</span>
          <Banknote size={24} className="text-gray-600 dark:text-gray-300" />
        </button>

        {groups.map((group) => (
          <React.Fragment key={group.title}>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-400 mb-2 ml-1">
              {group.title}
            </div>
            <div className="bg-white dark:bg-neutral-900 rounded-3xl p-4 mb-6">
              <div className="grid grid-cols-4 gap-4">
                {group.icons.map(icon => {
                  const fileName = theme === 'dark' 
                    ? (icon.darkFile || icon.file) 
                    : (icon.lightFile || icon.file);
                  
                  return (
                    <button
                      key={icon.key}
                      onClick={() => {
                        onSelect(icon.key);
                        onClose();
                      }}
                      className="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <img
                        src={`/icons/payment/${fileName}`}
                        alt={icon.name}
                        className="w-10 h-10 object-contain rounded-lg"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300 text-center">
                        {icon.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}