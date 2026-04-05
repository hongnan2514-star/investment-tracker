// components/SortFilterMenu.tsx
"use client";

import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const ASSET_TYPE_CONFIG: Record<string, { name: string; color: string }> = {
  stock: { name: '股票', color: '#1e67f7' },
  fund: { name: '基金', color: '#10b981' },
  crypto: { name: '加密货币', color: '#ec4899' },
  metal: { name: '贵金属', color: '#f59e0b' },
  car: { name: '车辆', color: '#06b6d4' },
  real_estate: { name: '不动产', color: '#f97316' },
  receivable: { name: '应收款', color: '#9b59b6' },
  custom: { name: '现金', color: '#95a5a6' },
  custom_asset: { name: '自定义', color: '#e4f806ff' },
  liability: { name: '负债', color: '#e74c3c' },
};

interface SortFilterMenuProps {
  show: boolean;
  onClose: () => void;
  sortBy: 'marketValue' | 'changePercent';
  sortOrder: 'asc' | 'desc';
  onSortChange: (by: 'marketValue' | 'changePercent', order: 'asc' | 'desc') => void;
  hiddenAssetTypes: Set<string>;
  allAssetTypes: string[];
  onToggleHiddenType: (type: string) => void;
}

export default function SortFilterMenu({
  show,
  onClose,
  sortBy,
  sortOrder,
  onSortChange,
  hiddenAssetTypes,
  allAssetTypes,
  onToggleHiddenType,
}: SortFilterMenuProps) {
  const [sortExpanded, setSortExpanded] = React.useState(false);
  const [filterExpanded, setFilterExpanded] = React.useState(false);

  if (!show) return null;

  const handleSortByMarketValue = () => {
    if (sortBy === 'marketValue') {
      onSortChange('marketValue', sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      onSortChange('marketValue', 'desc');
    }
  };

  const handleSortByChangePercent = () => {
    if (sortBy === 'changePercent') {
      onSortChange('changePercent', sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      onSortChange('changePercent', 'desc');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-4 top-20 z-50 bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-2 w-[160px] sm:min-w-[200px] max-w-[90vw]">
        {/* 排序方式标题行 */}
        <div
          className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          onClick={() => setSortExpanded(!sortExpanded)}
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">排序方式</span>
          <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${sortExpanded ? '' : '-rotate-90'}`} />
        </div>
        {sortExpanded && (
          <>
            {/* 持有额 */}
            <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              <span onClick={handleSortByMarketValue} className="cursor-pointer">持有额</span>
              <button onClick={handleSortByMarketValue} className="cursor-pointer p-0 focus:outline-none">
                {sortBy === 'marketValue' && sortOrder === 'asc' ? (
                  <ChevronUp size={16} className="text-[#ff8800]" />
                ) : sortBy === 'marketValue' && sortOrder === 'desc' ? (
                  <ChevronDown size={16} className="text-[#ff8800]" />
                ) : (
                  <ChevronDown size={16} className="text-gray-400 hover:text-gray-600" />
                )}
              </button>
            </div>
            {/* 盈亏率 */}
            <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              <span onClick={handleSortByChangePercent} className="cursor-pointer">盈亏率</span>
              <button onClick={handleSortByChangePercent} className="cursor-pointer p-0 focus:outline-none">
                {sortBy === 'changePercent' && sortOrder === 'asc' ? (
                  <ChevronUp size={16} className="text-[#ff8800]" />
                ) : sortBy === 'changePercent' && sortOrder === 'desc' ? (
                  <ChevronDown size={16} className="text-[#ff8800]" />
                ) : (
                  <ChevronDown size={16} className="text-gray-400 hover:text-gray-600" />
                )}
              </button>
            </div>
          </>
        )}

        <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

        {/* 筛选资产标题行 */}
        <div
          className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          onClick={() => setFilterExpanded(!filterExpanded)}
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">展示设置</span>
          <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${filterExpanded ? '' : '-rotate-90'}`} />
        </div>
        {filterExpanded && (
          <div className="mt-2 space-y-1">
            {allAssetTypes.length > 0 ? (
              allAssetTypes.map(type => {
                const config = ASSET_TYPE_CONFIG[type] || { name: type };
                return (
                  <button
                    key={type}
                    onClick={() => onToggleHiddenType(type)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      hiddenAssetTypes.has(type)
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        : 'bg-[#ff8800] text-white hover:bg-[#e07a00] dark:bg-[#ff8800] dark:hover:bg-[#e07a00]'
                    }`}
                  >
                    {config.name}
                  </button>
                );
              })
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400 px-3 py-2">暂无资产</div>
            )}
          </div>
        )}
      </div>
    </>
  );
}