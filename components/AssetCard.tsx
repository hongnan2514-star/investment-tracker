// components/AssetCard.tsx
"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap, BarChart3, Banknote, Receipt, Activity, ReceiptText, TrendingUp
} from 'lucide-react';
import { IoCarSport, IoReceipt } from "react-icons/io5";
import { FaHouse } from "react-icons/fa6";
import { AiOutlineStock } from "react-icons/ai";
import { MdOutlineReceiptLong } from "react-icons/md"

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
      ? 'text-[#ff0000] dark:text-red-400'
      : 'text-gray-900 dark:text-gray-100';
  }
  return asset.changePercent > 0
    ? 'text-green-600 dark:text-green-400'
    : asset.changePercent < 0
    ? 'text-[#ff0000] dark:text-red-400'
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
  const router = useRouter();
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

  // 从可能包含 _light/_dark 后缀的字符串中提取基础 key
const extractIconKey = (logoUrl: string): string => {
  // 提取文件名（去掉路径前缀）
  const fileName = logoUrl.split('/').pop() || logoUrl;
  // 如果已经是纯 key（不含 _light/_dark 且无 .png），直接返回
  if (!fileName.includes('_light') && !fileName.includes('_dark') && !fileName.includes('.png')) {
    return fileName;
  }
  // 否则去掉 _light/_dark 和 .png 后缀
  return fileName.replace(/_(light|dark)\.png$/, '').replace(/\.png$/, '');
};

  const renderIcon = () => {
    // A股本地Logo
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

    // 现金资产的自定义图标（支持主题切换，兼容旧数据）
    if (asset.type === 'custom' && asset.logoUrl) {
      const iconKey = extractIconKey(asset.logoUrl);
      const fileName = `${iconKey}_${theme === 'dark' ? 'dark' : 'light'}.png`;
      return (
        <div className="relative w-8 h-8">
          <img
            src={`/icons/payment/${fileName}`}
            alt="cash"
            className="w-8 h-8 object-contain rounded-lg"
            style={{ backgroundColor: 'transparent' }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent) {
                const fallback = parent.querySelector('.cash-fallback-icon');
                if (fallback) (fallback as HTMLElement).style.display = 'block';
              }
            }}
          />
          <Banknote size={20} className="cash-fallback-icon absolute inset-0 m-auto text-gray-500 hidden" />
        </div>
      );
    }

    // 其他有 logoUrl 的资产
    if (logoSrc) {
      return < img src={logoSrc} alt={asset.name} className="w-8 h-8 object-contain rounded-lg" />;
    }

    // 贵金属
    if (asset.type === 'metal') {
      const isSilver = asset.symbol && asset.symbol.includes('Ag');
      return isSilver ? (
        < img src={`/icons/silver-bar-${theme}.png`} alt="Silver" className="w-8 h-8 object-contain" />
      ) : (
        < img src={`/icons/gold-bar-${theme}.png`} alt="Gold" className="w-8 h-8 object-contain" />
      );
    }

    // 默认图标
    let IconComponent;
    switch (asset.type) {
      case 'car': IconComponent = IoCarSport; break;
      case 'stock': IconComponent = AiOutlineStock; break;
      case 'real_estate': IconComponent = FaHouse; break;
      case 'custom': IconComponent = Banknote; break;
      case 'receivable': IconComponent = IoReceipt; break;
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

  const handleClick = () => {
    if (asset.type === 'custom') {
      router.push(`/ledger/account/${encodeURIComponent(asset.symbol)}`);
    } else {
      onClick(asset.symbol);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="cursor-pointer bg-white dark:bg-[#0a0a0a] rounded-2xl border border-gray-100 dark:border-gray-800 transition-all overflow-hidden"
    >
      <div className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 mt-1">{renderIcon()}</div>
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

          <div className="flex items-start gap-2 flex-shrink-0 ml-2">
            {showCostBlock && (
              <div className="flex flex-col items-end text-xs mt-1">
                <span className="font-medium text-gray-500 dark:text-gray-400">
                  {Number(asset.price).toFixed(2)}
                </span>
                <span className="text-gray-500 dark:text-gray-400 font-normal">
                  {Number(asset.costPrice).toFixed(2)}
                </span>
              </div>
            )}
            <div className="text-right">
              <div className={`text-base font-black ${profitLossColor}`}>
                {formatLargeNumber(safeMarketValue)}
              </div>
              {displayPercent !== 0 && (
                <div className={`text-xs font-bold ${profitLossSmallColor}`}>
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