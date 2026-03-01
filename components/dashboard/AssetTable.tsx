import React from 'react';
import { Asset } from '@/types';

const mockAssets: Asset[] = [
  { id: '1', symbol: 'AAPL', name: 'Apple Inc.', holdings: 10, avgPrice: 150, currentPrice: 185.20, change: 1.5 },
  { id: '2', symbol: 'BTC', name: 'Bitcoin', holdings: 0.5, avgPrice: 45000, currentPrice: 62000.45, change: -2.1 },
  { id: '3', symbol: 'TSLA', name: 'Tesla, Inc.', holdings: 5, avgPrice: 200, currentPrice: 175.30, change: 0.8 },
];

export default function AssetTable() {
  return (
    <div className="flex flex-col gap-3">
      {/* 表头：手动模拟，增加 whitespace-nowrap 防止文字竖过来 */}
      <div className="flex px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
        <div className="flex-[2]">资产</div>
        <div className="flex-1 text-right">总市值</div>
      </div>

      {/* 列表内容 */}
{mockAssets.map((asset) => {
  const marketValue = asset.holdings * asset.currentPrice;
  const isPositive = asset.change >= 0;

  return (
    <div key={asset.id} className="flex items-center justify-between px-4 py-4 bg-white rounded-2xl mb-2 shadow-sm border border-gray-50">
      {/* 1. 左侧：币种信息 */}
      <div className="flex items-center gap-3">
        {/* 这里以后可以加图标 */}
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <span className="text-base font-bold text-gray-900">{asset.symbol}</span>
          </div>
          <span className="text-xs text-gray-400 font-medium">
            ${asset.currentPrice.toLocaleString()}
          </span>
        </div>
      </div>

      {/* 2. 右侧：市值与涨跌幅 */}
      <div className="flex items-center gap-4">
        <div className="text-right">

            {/** 总市值 */}
          <div className="text-sm font-bold text-gray-900">
            {marketValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        
        {/* 涨跌幅按钮样式 */}
        <div className={`w-16 py-1.5 rounded-lg text-center text-xs font-bold text-white ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}>
          {isPositive ? '+' : ''}{asset.change}%
        </div>
      </div>
    </div>
  );
})}
    </div>
  );
}