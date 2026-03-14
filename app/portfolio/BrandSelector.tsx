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

  // 按首字母分组
  const grouped = useMemo(() => {
    const groups: Record<string, Brand[]> = {};
    filteredBrands.forEach(b => {
      const letter = b.firstLetter;
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

  // 滚动到指定字母分组
  const scrollToLetter = (letter: string) => {
    const element = document.getElementById(`brand-${letter}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="fixed inset-0 bg-white dark:bg-black z-50 flex flex-col overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center gap-4 p-4">
        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">选择品牌</h1>
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
            className="w-full bg-gray-100 dark:bg-[#1a1a1a] border-0 p-3 pl-10 rounded-xl text-gray-900 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500"
            autoFocus
          />
        </div>
      </div>

      {/* 主内容区：品牌列表 + 右侧字母导航（整合在列表内） */}
      <div className="flex-1 overflow-hidden">
        {/* 品牌列表容器：相对定位，预留右侧空间给字母导航，滚动条在最右边 */}
        <div className="relative h-full overflow-y-auto pr-10">
          {/* 品牌列表内容 */}
          <div className="p-4">
            {grouped.sortedKeys.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 mt-8">未找到匹配的品牌</p >
            ) : (
              grouped.sortedKeys.map(letter => (
                <div key={letter} id={`brand-${letter}`} className="mb-4">
                  <div className="grid grid-cols-1 gap-2">
                    {grouped.groups[letter].map(brand => (
                      <button
                        key={brand.id}
                        onClick={() => onSelect(brand)}
                        className="flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-left"
                      >
                        {brand.logoUrl ? (
                          < img src={brand.logoUrl} alt={brand.name} className="w-6 h-6 object-contain" />
                        ) : (
                          <Car size={18} className="text-gray-700 dark:text-gray-200" />
                        )}
                        <span className="text-base text-gray-900 dark:text-gray-100">
                          {brand.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 右侧垂直字母导航 - 绝对定位在预留空间内，不随滚动条移动 */}
          {grouped.sortedKeys.length > 0 && (
            <div className="absolute top-0 right-0 w-10 h-full flex flex-col items-center justify-start py-4 gap-1">
              {grouped.sortedKeys.map(letter => (
                <button
                  key={letter}
                  onClick={() => scrollToLetter(letter)}
                  className="w-8 h-8 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {letter}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}