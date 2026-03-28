// components/dashboard/SummaryCard.tsx
// components/dashboard/SummaryCard.tsx
"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Eye, EyeClosed } from 'lucide-react';
import { Asset } from '@/src/constants/types';
import { eventBus } from '@/src/utils/eventBus';
import { recordSnapshot } from '@/src/services/historyService';
import ExpandedChart from './ExpandedChart';
import MiniChart from './MiniChart';
import { useCurrency, useCurrencyConverter } from '@/src/services/currency';
import { getCurrentUserId } from '@/src/utils/assetStorage';

type Period = '1W' | '1M' | '6M';

// ---------- 缓存机制 ----------
// 按用户ID缓存资产数据，有效期15分钟
type CacheEntry = {
  assets: Asset[];
  timestamp: number;
};
const assetCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 15 * 60 * 1000; // 15分钟

export default function SummaryCard() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [convertedTotalAssets, setConvertedTotalAssets] = useState<number>(0);
  const [convertedTotalLiabilities, setConvertedTotalLiabilities] = useState<number>(0);
  const [convertedNetWorth, setConvertedNetWorth] = useState<number>(0);
  const [convertedProfit, setConvertedProfit] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('1W');
  const [hoverNetWorth, setHoverNetWorth] = useState<number | null>(null);
  const [isAmountHidden, setIsAmountHidden] = useState(false);

  const { currency, symbol } = useCurrency();
  const { convert, loading: converting } = useCurrencyConverter();

  const [midnightSnapshotCNY, setMidnightSnapshotCNY] = useState<number | null>(null);
  const [netWorthCNY, setNetWorthCNY] = useState<number>(0);

  // 加载资产（带缓存）
  const loadAssets = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId) {
      setAssets([]);
      setLoadingAssets(false);
      return;
    }

    // 检查缓存是否有效
    const cached = assetCache.get(userId);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log('[SummaryCard] 使用缓存的资产数据，userId:', userId);
      setAssets(cached.assets);
      setLoadingAssets(false);
      return;
    }

    // 缓存无效，重新请求
    setLoadingAssets(true);
    try {
      const res = await fetch('/api/asset', {
        headers: { 'x-user-id': userId },
      });
      if (!res.ok) throw new Error('加载资产失败');
      const data = await res.json();
      const normalizedData = data.map((asset: any) => ({
        ...asset,
        price: Number(asset.price),
        holdings: Number(asset.holdings),
        marketValue: Number(asset.marketValue),
        costPrice: asset.costPrice ? Number(asset.costPrice) : undefined,
        changePercent: asset.changePercent ? Number(asset.changePercent) : 0,
      }));
      // 存入缓存
      assetCache.set(userId, {
        assets: normalizedData,
        timestamp: Date.now(),
      });
      setAssets(normalizedData);
    } catch (err) {
      console.error('加载资产失败', err);
      setAssets([]);
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  // 计算总资产、负债、净值、利润（使用当前货币和 CNY）
  const refreshData = useCallback(async () => {
    if (assets.length === 0) {
      setConvertedTotalAssets(0);
      setConvertedTotalLiabilities(0);
      setConvertedNetWorth(0);
      setConvertedProfit(0);
      setNetWorthCNY(0);
      return;
    }

    let assetsSum = 0;
    let liabilitiesSum = 0;
    let profitSum = 0;
    let assetsSumCNY = 0;
    let liabilitiesSumCNY = 0;

    await Promise.all(
      assets.map(async (asset) => {
        const fromCurrency = asset.currency || 'USD';
        const convertedValue = await convert(asset.marketValue, fromCurrency as any, currency);
        if (asset.type === 'liability') {
          liabilitiesSum += Math.abs(convertedValue);
        } else {
          assetsSum += convertedValue;
        }

        const convertedValueCNY = await convert(asset.marketValue, fromCurrency as any, 'CNY');
        if (asset.type === 'liability') {
          liabilitiesSumCNY += Math.abs(convertedValueCNY);
        } else {
          assetsSumCNY += convertedValueCNY;
        }

        const assetProfit = asset.price * asset.holdings * (asset.changePercent || 0) / 100;
        const convertedProfitValue = await convert(assetProfit, fromCurrency as any, currency);
        profitSum += convertedProfitValue;
      })
    );

    setConvertedTotalAssets(assetsSum);
    setConvertedTotalLiabilities(liabilitiesSum);
    setConvertedNetWorth(assetsSum - liabilitiesSum);
    setConvertedProfit(profitSum);
    setNetWorthCNY(assetsSumCNY - liabilitiesSumCNY);
  }, [assets, currency, convert]);

  // 获取今日0点快照
  useEffect(() => {
    const fetchMidnightSnapshot = async () => {
      const userId = getCurrentUserId();
      if (!userId) return;
      try {
        const res = await fetch(`/api/snapshot/midnight?userId=${userId}`);
        const data = await res.json();
        if (data.netWorth !== null) setMidnightSnapshotCNY(data.netWorth);
      } catch (err) {
        console.error('获取今日快照失败', err);
      }
    };
    fetchMidnightSnapshot();
  }, []);

  // 今日收益（CNY）
  const todayProfitCNY = midnightSnapshotCNY !== null ? netWorthCNY - midnightSnapshotCNY : 0;
  const todayProfitConverted = useCallback(async () => {
    if (todayProfitCNY === 0) return 0;
    return await convert(todayProfitCNY, 'CNY', currency);
  }, [todayProfitCNY, currency, convert]);

  // 更新今日收益显示
  useEffect(() => {
    let isActive = true;
    (async () => {
      const profit = await todayProfitConverted();
      if (isActive) setConvertedProfit(profit);
    })();
    return () => { isActive = false; };
  }, [todayProfitConverted]);

  // 监听资产变化事件（清除缓存并重新加载）
  useEffect(() => {
    const handleAssetsUpdate = () => {
      const userId = getCurrentUserId();
      if (userId) assetCache.delete(userId); // 清除当前用户的缓存
      loadAssets();
    };
    const handleUserChange = () => {
      assetCache.clear(); // 用户切换时清除所有缓存
      loadAssets();
    };
    const unsubscribeAssets = eventBus.subscribe('assetsUpdated', handleAssetsUpdate);
    const unsubscribeUser = eventBus.subscribe('userChanged', handleUserChange);
    return () => {
      unsubscribeAssets();
      unsubscribeUser();
    };
  }, [loadAssets]);

  // 资产变化时重新计算
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // 初始加载
  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // 记录快照（当资产变化时）
  useEffect(() => {
    if (assets.length > 0) {
      recordSnapshot();
    }
  }, [assets]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsExpanded(false);
      setIsClosing(false);
    }, 300);
  };

  const profitSign = convertedProfit > 0 ? '+' : convertedProfit < 0 ? '-' : '';
  const profitColorClass =
    convertedProfit > 0 ? 'text-green-500' :
      convertedProfit < 0 ? 'text-red-500' : 'text-gray-500 dark:text-gray-400';

  const handleHoverValue = (value: number | null) => {
    setHoverNetWorth(value);
  };

  const displayNetWorth = hoverNetWorth !== null ? hoverNetWorth : convertedNetWorth;

  const toggleAmountHidden = () => {
    const newHidden = !isAmountHidden;
    setIsAmountHidden(newHidden);
    eventBus.emit('toggleAmountVisibility', newHidden);
  };

  const formatLargeNumber = (num: number): string => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  // 骨架屏组件
  const SkeletonLine = ({ className = "w-24 h-6" }: { className?: string }) => (
    <div className={`relative overflow-hidden bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${className}`} />
  );

  // 加载状态下的骨架屏版本
  if (loadingAssets) {
    return (
      <div className="mb-6 px-2">
        <div className="flex justify-between items-start">
          <div className="flex flex-col flex-1">
            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
              <span className="text-xs font-semibold">净资产估值</span>
              <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                <Eye size={14} />
              </button>
            </div>
            <div className="flex items-baseline gap-1">
              <SkeletonLine className="w-28 h-8" />
              <SkeletonLine className="w-8 h-4" />
            </div>
            <div className="mt-2">
              <SkeletonLine className="w-32 h-4" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="bg-[#ff8800] dark:bg-[#ff8800] rounded-2xl py-1.5 px-3 shadow-sm flex items-center justify-between">
            <span className="text-xs font-medium text-white">资产</span>
            <SkeletonLine className="w-16 h-5 bg-white/30" />
          </div>
          <div className="bg-[#ff8800] dark:bg-[#ff8800] rounded-2xl py-1.5 px-3 shadow-sm flex items-center justify-between">
            <span className="text-xs font-medium text-white">负债</span>
            <SkeletonLine className="w-16 h-5 bg-white/30" />
          </div>
        </div>
      </div>
    );
  }

  // 正常渲染
  return (
    <div className="mb-6 px-2">
      <div className="flex justify-between items-start">
        <div className="flex flex-col flex-1">
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
            <span className="text-xs font-semibold">净资产估值</span>
            {converting && <span className="text-xs text-blue-500 animate-pulse">汇率更新中...</span>}
            <button
              onClick={toggleAmountHidden}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors focus:outline-none focus:ring-0"
              aria-label="隐藏金额"
              style={{ outline: 'none' }}
            >
              {isAmountHidden ? <EyeClosed size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="flex items-baseline gap-1">
            <h2 className="text-3xl font-black tracking-tight text-gray-900 dark:text-gray-100 inline-flex items-baseline gap-1">
              {isAmountHidden ? (
                <span className="tracking-widest">****</span>
              ) : (
                <>
                  <span>{formatLargeNumber(displayNetWorth)}</span>
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400">{currency}</span>
                </>
              )}
            </h2>
          </div>
          <p className="text-sm font-bold mt-2">
            <span className="text-gray-400 dark:text-gray-400">今日收益</span>{' '}
            {isAmountHidden ? (
              <span className="text-gray-400 dark:text-gray-400">****</span>
            ) : (
              <span className={profitColorClass}>
                {profitSign}{symbol}{formatLargeNumber(Math.abs(convertedProfit))}
                {convertedNetWorth > 0 && (
                  <> ({profitSign}{(convertedProfit / convertedNetWorth * 100).toFixed(2)}%)</>
                )}
              </span>
            )}
          </p >
        </div>

        {!isExpanded && !isClosing && (
        <div className="-ml-2 mt-2">
          <MiniChart
            period={selectedPeriod}
            totalValue={convertedNetWorth}
            currencySymbol={symbol}
            profit={convertedProfit}
            onClick={() => setIsExpanded(true)}
          />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="bg-[#ff8800] dark:bg-[#ff8800] rounded-2xl py-1.5 px-3 shadow-sm flex items-center justify-between">
          <span className="text-xs font-medium text-white">资产</span>
          {isAmountHidden ? (
            <span className="text-lg font-SF text-white leading-tight">****</span>
          ) : (
            <span className="text-lg font-SF text-white leading-tight">
              {formatLargeNumber(convertedTotalAssets)}
            </span>
          )}
        </div>
        <div className="bg-[#ff8800] dark:bg-[#ff8800] rounded-2xl py-1.5 px-3 shadow-sm flex items-center justify-between">
          <span className="text-xs font-medium text-white">负债</span>
          {isAmountHidden ? (
            <span className="text-lg font-SF text-white leading-tight">****</span>
          ) : (
            <span className="text-lg font-SF text-white leading-tight">
              -{formatLargeNumber(convertedTotalLiabilities)}
            </span>
          )}
        </div>
      </div>

      {(isExpanded || isClosing) && (
        <div
          className={`mt-6 pt-6 transition-all duration-300 ease-in-out transform ${
            isClosing ? 'opacity-0 -translate-y-4' : 'opacity-100 translate-y-0'
          }`}
          onTransitionEnd={() => {
            if (isClosing) {
              setIsExpanded(false);
              setIsClosing(false);
            }
          }}
        >
          <ExpandedChart
            totalValue={convertedNetWorth}
            currencySymbol={symbol}
            todayProfit={convertedProfit}
            onClose={handleClose}
            period={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            onHoverValueChange={handleHoverValue}
          />
        </div>
      )}
    </div>
  );
}