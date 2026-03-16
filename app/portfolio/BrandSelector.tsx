// app/portfolio/BrandSelector.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { ArrowLeft, Search, Car } from 'lucide-react';

interface Brand {
  id: string;
  name: string;
  firstLetter: string;
  logoUrl?: string;
}

interface BrandSelectorProps {
  brands: Brand[];
  onSelect: (brand: Brand) => void;
  onClose: () => void;
}

export default function BrandSelector({ brands, onSelect, onClose }: BrandSelectorProps) {
  const [search, setSearch] = useState('');

  // 二次过滤：确保每个品牌有有效的 name
  const validBrands = useMemo(() => {
    return brands.filter(b => b && b.name && typeof b.name === 'string' && b.name.trim() !== '');
  }, [brands]);

  // 过滤品牌（基于搜索）
  const filteredBrands = useMemo(() => {
    return validBrands.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));
  }, [validBrands, search]);

  // 按首字母分组（去除空格）
  const grouped = useMemo(() => {
    const groups: Record<string, Brand[]> = {};
    filteredBrands.forEach(b => {
      const letter = b.firstLetter.trim();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(b);
    });
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    });
    return { groups, sortedKeys };
  }, [filteredBrands]);

  return (
    <div className="fixed inset-0 bg-white dark:bg-black z-50 flex flex-col overflow-hidden">
      {/* 头部：返回按钮带灰色圆框（默认可见） */}
<div className="flex items-center p-4">
  <button
    onClick={onClose}
    className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full"
  >
    <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
  </button>
</div>

      {/* 搜索框 */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="搜索品牌"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-100 dark:bg-[#1a1a1a] border-0 p-3 pl-10 rounded-3xl text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500"
            autoFocus
          />
        </div>
      </div>

      {/* 品牌列表 - 可滚动但滚动条隐藏 */}
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="p-4">
          {grouped.sortedKeys.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 mt-8">未找到匹配的品牌</p >
          ) : (
            grouped.sortedKeys.map(letter => (
              <div key={letter} id={`brand-${letter}`} className="mb-6">
                {/* 分组标题 */}
                <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 ml-1">
                  {letter}
                </div>
                {/* 大背景框 */}
                <div className="bg-gray-200 dark:bg-gray-950 rounded-3xl p-4">
                  <div className="grid grid-cols-4 gap-4">
                    {grouped.groups[letter].map(brand => (
                      <button
                        key={brand.id}
                        onClick={() => onSelect(brand)}
                        className="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-900 transition-colors"
                      >
                        {brand.logoUrl ? (
                          <img
                            src={brand.logoUrl}
                            alt={brand.name}
                            className="w-10 h-10 object-contain rounded-xl"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                        ) : (
                          <div className="w-10 h-10 flex items-center justify-center">
                            <Car size={24} className="text-gray-700 dark:text-gray-300" />
                          </div>
                        )}
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300 text-center line-clamp-2">
                          {brand.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}