// components/AssetCard.tsx
"use client";

import React from 'react';
import {
  Zap, BarChart3, Hotel, CarFront, Banknote, Receipt, Activity, ReceiptText, TrendingUp
} from 'lucide-react';
import { Asset } from '@/src/constants/types';
import { getCachedLogo } from '@/src/utils/logoCache';
import { useTheme } from '@/app/ThemeProvider';

const formatLargeNumber = (num: number): string => {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
  return num.toFixed(2);
};

const getProfitLossColor = (asset: Asset): string => {
  if (asset.costPrice && asset.costPrice > 0) {
    return asset.price > asset.costPrice
      ? 'text-green-600 dark:text-green-400'
      : asset.price < asset.costPrice
      ? 'text-red-600 dark:text-red-400'
      : 'text-gray-900 dark:text-gray-100';
  }
  return asset.changePercent > 0
    ? 'text-green-600 dark:text-green-400'
    : asset.changePercent < 0
    ? 'text-red-600 dark:text-red-400'
    : 'text-gray-900 dark:text-gray-100';
};

const getProfitLossSmallColor = (asset: Asset): string => {
  if (asset.costPrice && asset.costPrice > 0) {
    return asset.price > asset.costPrice
      ? 'text-green-500 dark:text-green-400'
      : asset.price < asset.costPrice
      ? 'text-red-500 dark:text-red-400'
      : 'text-gray-500 dark:text-gray-400';
  }
  return asset.changePercent > 0
    ? 'text-green-500 dark:text-green-400'
    : asset.changePercent < 0
    ? 'text-red-500 dark:text-red-400'
    : 'text-gray-500 dark:text-gray-400';
};

interface AssetCardProps {
  asset: Asset;
  onClick: (symbol: string) => void;
}

export default function AssetCard({ asset, onClick }: AssetCardProps) {
  const { theme } = useTheme();

  const isSimpleAsset = ['car', 'custom', 'liability', 'real_estate', 'receivable', 'custom_asset'].includes(asset.type);

  const safeMarketValue =
    asset.marketValue != null && !isNaN(asset.marketValue) && isFinite(asset.marketValue)
      ? asset.marketValue
      : asset.holdings * asset.price;

  let displayPercent = Number(asset.changePercent) || 0;
  let displayPercentSign = displayPercent > 0 ? '+' : '';
  if (asset.costPrice && asset.costPrice > 0) {
    const calculatedPercent = ((Number(asset.price) - Number(asset.costPrice)) / Number(asset.costPrice)) * 100;
    displayPercent = calculatedPercent;
    displayPercentSign = calculatedPercent > 0 ? '+' : '';
  }

  const profitLossColor = getProfitLossColor(asset);
  const profitLossSmallColor = getProfitLossSmallColor(asset);
  const cachedLogo = getCachedLogo(asset.symbol);
  const logoSrc = cachedLogo || asset.logoUrl;

  const isAStock = asset.symbol && /^\d{6}\.(SS|SZ)$/.test(asset.symbol);
  const aStockCode = isAStock ? asset.symbol.split('.')[0] : null;

  const getSubtitle = () => {
    if (asset.type === 'real_estate' || asset.type === 'car') {
      const lastDashIndex = asset.symbol.lastIndexOf('-');
      if (lastDashIndex !== -1) {
        const timestampStr = asset.symbol.substring(lastDashIndex + 1);
        const timestamp = parseInt(timestampStr, 10);
        if (!isNaN(timestamp)) {
          const date = new Date(timestamp);
          if (!isNaN(date.getTime())) {
            return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
          }
        }
      }
    }
    return asset.symbol;
  };

  const renderIcon = () => {
    // A股特殊处理（保持原有逻辑）
    if (isAStock && aStockCode) {
      const localPath = `/images/company_logos/${aStockCode}.png`;
      return (
        <div className="relative w-8 h-8">
          <img
            src={localPath}
            alt={asset.name}
            className="w-8 h-8 object-contain rounded-lg absolute inset-0"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent) {
                const icon = parent.querySelector('.stock-fallback-icon');
                if (icon) (icon as HTMLElement).style.display = 'block';
              }
            }}
          />
          <TrendingUp size={20} className="stock-fallback-icon w-8 h-8 text-gray-500 absolute inset-0 hidden" />
        </div>
      );
    }

    // 有缓存的 Logo（图片）
    if (logoSrc) {
      return < img src={logoSrc} alt={asset.name} className="w-8 h-8 object-contain rounded-lg" />;
    }

    // 金属图标（图片）
    if (asset.type === 'metal') {
      const isSilver = asset.symbol && asset.symbol.includes('Ag');
      return isSilver ? (
        < img src={`/icons/silver-bar-${theme}.png`} alt="Silver" className="w-8 h-8 object-contain" />
      ) : (
        < img src={`/icons/gold-bar-${theme}.png`} alt="Gold" className="w-8 h-8 object-contain" />
      );
    }

    // 其他情况：返回 Lucide 图标，放在统一容器中
    let IconComponent;
    switch (asset.type) {
      case 'car': IconComponent = CarFront; break;
      case 'stock': IconComponent = Zap; break;
      case 'real_estate': IconComponent = Hotel; break;
      case 'custom': IconComponent = Banknote; break;
      case 'receivable': IconComponent = Receipt; break;
      case 'custom_asset': IconComponent = Activity; break;
      case 'liability': IconComponent = ReceiptText; break;
      default: IconComponent = BarChart3;
    }

    return (
      <div className="w-8 h-8 flex items-center justify-center text-gray-600 dark:text-gray-400">
        <IconComponent size={20} />
      </div>
    );
  };

  const showCostBlock = asset.costPrice && !isSimpleAsset;

  return (
    <div
      onClick={() => onClick(asset.symbol)}
      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
    >
      <div className="px-2 py-0">
        <div className="flex items-start justify-between">
          {/* 左侧信息区 */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0">{renderIcon()}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-gray-900 dark:text-gray-100 text-sm truncate">
                  {asset.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {typeof asset.holdings === 'number' ? asset.holdings.toFixed(2) : '0.00'}份
                </span>
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                {getSubtitle()}
              </div>
            </div>
          </div>

          {/* 右侧信息区 */}
          <div className="flex items-start gap-2 flex-shrink-0 ml-2 mt-1">
            {showCostBlock && (
  <div className="flex flex-col items-end text-xs">
    <span className="font-medium text-gray-500 dark:text-gray-400">
      {Number(asset.price).toFixed(2)}
    </span>
    <span className="text-gray-500 dark:text-gray-400 font-normal">
      {Number(asset.costPrice).toFixed(2)}
    </span>
  </div>
)}
            <div className="text-right">
              <div className={`text-base font-black ${profitLossColor} relative -top-1`}>
                {formatLargeNumber(safeMarketValue)}
              </div>
              {displayPercent !== 0 && (
                <div className={`text-xs font-bold ${profitLossSmallColor} relative -top-2`}>
                  {displayPercentSign}{displayPercent.toFixed(2)}%
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}