// components/CategorySelector.tsx
"use client";

import React, { useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';

export interface Category {
  name: string;
  icon: string;
}

// 收入分类列表
export const INCOME_CATEGORIES: Category[] = [
  { name: '工资', icon: '💰' },
  { name: '兼职', icon: '💼' },
  { name: '理财', icon: '📈' },
  { name: '红包', icon: '🧧' },
  { name: '其他', icon: '📝' },
];

// 支出分类列表
export const EXPENSE_CATEGORIES: Category[] = [
  { name: '餐饮', icon: '🍜' },
  { name: '购物', icon: '🛒' },
  { name: '交通', icon: '🚗' },
  { name: '娱乐', icon: '🎬' },
  { name: '医疗', icon: '💊' },
  { name: '房租', icon: '🏠' },
  { name: '其他', icon: '📝' },
];

interface CategorySelectorProps {
  type: 'income' | 'expense';
  onSelect: (categoryName: string) => void;
  onClose: () => void;
}

export default function CategorySelector({ type, onSelect, onClose }: CategorySelectorProps) {
  const [search, setSearch] = useState('');
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-white dark:bg-black z-50 flex flex-col overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center p-4">
        <button
          onClick={onClose}
          className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full"
        >
          <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
        </button>
        <h2 className="text-xl font-bold ml-4 text-gray-900 dark:text-gray-100">
          选择{type === 'income' ? '收入' : '支出'}分类
        </h2>
      </div>

      {/* 搜索框 */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="搜索分类"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-100 dark:bg-[#1a1a1a] border-0 p-3 pl-10 rounded-3xl text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-orange-500"
            autoFocus
          />
        </div>
      </div>

      {/* 分类网格 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-4 gap-4">
          {filteredCategories.map(cat => (
            <button
              key={cat.name}
              onClick={() => onSelect(cat.name)}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-2xl">
                {cat.icon}
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {cat.name}
              </span>
            </button>
          ))}
        </div>
        {filteredCategories.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400 mt-8">未找到匹配的分类</p>
        )}
      </div>
    </div>
  );
}