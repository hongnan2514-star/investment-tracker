// components/AssetStats.tsx
import React from 'react';
import { Asset } from '@/src/constants/types';

interface AssetStatsProps {
  asset: Asset;               // 原始资产数据（用于持仓数量）
  displayAsset: Asset;       // 转换后的资产数据（用于价格、成本、市值）
  formatLargeNumber: (num: number) => string;
}

export default function AssetStats({ asset, displayAsset, formatLargeNumber }: AssetStatsProps) {
  return (
    <div className="flex flex-col gap-0 ml-auto ml-10">
      <div className="leading-4">
        <span className="inline-block w-16 text-left text-[10px] text-gray-500 dark:text-gray-400">当前市价</span>
        <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
          {formatLargeNumber(displayAsset.price)}
        </span>
      </div>
      <div className="leading-4">
        <span className="inline-block w-16 text-left text-[10px] text-gray-500 dark:text-gray-400">持仓数量</span>
        <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
          {formatLargeNumber(asset.holdings)}
        </span>
      </div>
      <div className="leading-4">
        <span className="inline-block w-16 text-left text-[10px] text-gray-500 dark:text-gray-400">成本均价</span>
        <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
          {displayAsset.costPrice ? formatLargeNumber(displayAsset.costPrice) : '--'}
        </span>
      </div>
      <div className="leading-4">
        <span className="inline-block w-16 text-left text-[10px] text-gray-500 dark:text-gray-400">持仓金额</span>
        <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
          {formatLargeNumber(displayAsset.marketValue)}
        </span>
      </div>
    </div>
  );
}