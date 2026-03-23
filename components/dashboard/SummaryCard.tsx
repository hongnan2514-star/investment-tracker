// components/dashboard/SummaryCard.tsx
"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Eye, EyeClosed } from 'lucide-react';
import { getAssets } from '@/src/utils/assetStorage';
import { Asset } from '@/src/constants/types';
import { eventBus } from '@/src/utils/eventBus';
import { recordSnapshot } from '@/src/services/historyService';
import ExpandedChart from './ExpandedChart';
import MiniChart from './MiniChart';
import { useCurrency, useCurrencyConverter } from '@/src/services/currency';
import { getCurrentUserId } from '@/src/utils/assetStorage';

type Period = '1W' | '1M' | '6M';

export default function SummaryCard() {
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
  const { convert, loading } = useCurrencyConverter();

  const [midnightSnapshotCNY, setMidnightSnapshotCNY] = useState<number | null>(null);
  const [netWorthCNY, setNetWorthCNY] = useState<number>(0);

  const formatLargeNumber = (num: number): string => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  const refreshData = useCallback(async () => {
    const assets = getAssets() as Asset[];
    let assetsSum = 0;
    let liabilitiesSum = 0;
    let profitSum = 0;
    let assetsSumCNY = 0;
    let liabilitiesSumCNY = 0;

    await Promise.all(
      assets.map(async (asset) => {
        const fromCurrency = asset.currency || 'USD';
        // 转换为当前货币
        const convertedValue = await convert(asset.marketValue, fromCurrency as any, currency);
        if (asset.type === 'liability') {
          liabilitiesSum += Math.abs(convertedValue);
        } else {
          assetsSum += convertedValue;
        }

        // 转换为 CNY（用于今日收益计算）
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
  }, [currency, convert]);

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

  // 计算今日收益（CNY），并转换为当前货币显示
  const todayProfitCNY = midnightSnapshotCNY !== null ? netWorthCNY - midnightSnapshotCNY : 0;
  const todayProfitConverted = useCallback(async () => {
    if (todayProfitCNY === 0) return 0;
    return await convert(todayProfitCNY, 'CNY', currency);
  }, [todayProfitCNY, currency, convert]);

  // 更新今日收益显示（异步）
  useEffect(() => {
    let isActive = true;
    (async () => {
      const profit = await todayProfitConverted();
      if (isActive) setConvertedProfit(profit);
    })();
    return () => { isActive = false; };
  }, [todayProfitConverted]);

  useEffect(() => {
    recordSnapshot();
    refreshData();

    const unsubscribeAssets = eventBus.subscribe('assetsUpdated', () => {
      refreshData();
    });

    const unsubscribeUser = eventBus.subscribe('userChanged', () => {
      refreshData();
    });

    return () => {
      unsubscribeAssets();
      unsubscribeUser();
    };
  }, [refreshData]);

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

  // 处理悬停时的净值更新
  const handleHoverValue = (value: number | null) => {
    setHoverNetWorth(value);
  };

  const displayNetWorth = hoverNetWorth !== null ? hoverNetWorth : convertedNetWorth;

  // 切换金额隐藏状态
  const toggleAmountHidden = () => {
    const newHidden = !isAmountHidden;
    setIsAmountHidden(newHidden);
    eventBus.emit('toggleAmountVisibility', newHidden);
  };

  return (
    <div className="mb-6 px-2">
      {/* 净资产估值区域 */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col flex-1">
          {/* 标题行：净资产估值 + 眼睛按钮 */}
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
            <span className="text-xs font-semibold">净资产估值</span>
            {loading && <span className="text-xs text-blue-500 animate-pulse">汇率更新中...</span>}
            <button
              onClick={toggleAmountHidden}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors focus:outline-none focus:ring-0"
              aria-label="隐藏金额"
              style={{ outline: 'none' }}
            >
              {isAmountHidden ? <EyeClosed size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {/* 数字和今日收益 */}
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

        {/* 迷你走势图 */}
        {!isExpanded && !isClosing && (
          <MiniChart
            period={selectedPeriod}
            totalValue={convertedNetWorth}
            currencySymbol={symbol}
            profit={convertedProfit}
            onClick={() => setIsExpanded(true)}
          />
        )}
      </div>

      {/* 资产与负债卡片 */}
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

      {/* 展开区域 */}
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