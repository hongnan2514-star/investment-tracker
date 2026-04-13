// components/dashboard/SummaryCard.tsx
"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Eye, EyeClosed } from 'lucide-react';
import { Asset } from '@/src/constants/types';
import { eventBus } from '@/src/utils/eventBus';
import { recordSnapshot } from '@/src/services/historyService';
import { useCurrency, useCurrencyConverter } from '@/src/services/currency';
import ChartView from './ChartView';
import { getCurrentUserId } from '@/src/utils/assetStorage';

type Period = '1W' | '1M' | '6M';

interface SummaryCardProps {
  assets: Asset[];
}

export default function SummaryCard({ assets }: SummaryCardProps) {
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
  const { convert } = useCurrencyConverter();

  const [midnightSnapshotCNY, setMidnightSnapshotCNY] = useState<number | null>(null);
  const [netWorthCNY, setNetWorthCNY] = useState<number>(0);
  const [isConverting, setIsConverting] = useState(false);

  const [dots, setDots] = useState(1);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isConverting) {
      intervalRef.current = setInterval(() => {
        setDots(prev => (prev % 4) + 1);
      }, 300);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setDots(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isConverting]);

  const dotsText = '.'.repeat(dots);

  // 计算总资产、负债、净值
  const refreshData = useCallback(async () => {
    if (assets.length === 0) {
      setConvertedTotalAssets(0);
      setConvertedTotalLiabilities(0);
      setConvertedNetWorth(0);
      setNetWorthCNY(0);
      return;
    }

    setIsConverting(true);
    try {
      let assetsSum = 0;
      let liabilitiesSum = 0;
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
        })
      );

      setConvertedTotalAssets(assetsSum);
      setConvertedTotalLiabilities(liabilitiesSum);
      setConvertedNetWorth(assetsSum - liabilitiesSum);
      setNetWorthCNY(assetsSumCNY - liabilitiesSumCNY);
    } finally {
      setIsConverting(false);
    }
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

  // 计算今日盈亏
  useEffect(() => {
    const computeTodayProfit = async () => {
      if (midnightSnapshotCNY === null) {
        setConvertedProfit(0);
        return;
      }
      const profitCNY = netWorthCNY - midnightSnapshotCNY;
      if (profitCNY === 0) {
        setConvertedProfit(0);
        return;
      }
      const profit = await convert(profitCNY, 'CNY', currency);
      setConvertedProfit(profit);
    };
    computeTodayProfit();
  }, [midnightSnapshotCNY, netWorthCNY, currency, convert]);

  // 资产或货币变化时重新计算
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // 记录快照
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

  if (assets.length === 0) {
    return (
      <div className="mb-6 px-2">
        <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 text-center text-gray-400 dark:text-gray-500">
          暂无资产数据
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 px-2">
      <div className="flex justify-between items-start">
        <div className="flex flex-col flex-1">
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
            <span className="text-xs font-semibold">净资产估值</span>
            <button
              onClick={toggleAmountHidden}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors focus:outline-none focus:ring-0"
              aria-label="隐藏金额"
            >
              {isAmountHidden ? <EyeClosed size={14} /> : <Eye size={14} />}
            </button>
            {isConverting && <span className="text-xs text-blue-500 animate-pulse">{dotsText}</span>}
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
            <span className="text-gray-400 dark:text-gray-400">今日盈亏</span>{' '}
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
          </p>
        </div>

        {!isExpanded && !isClosing && (
          <div
            className="-ml-2 mt-2 cursor-pointer hover:opacity-80 transition active:scale-95"
            onClick={() => setIsExpanded(true)}
          >
            <ChartView
              mode="mini"
              period={selectedPeriod}
              totalValue={convertedNetWorth}
              currencySymbol={symbol}
              todayProfit={convertedProfit}
              onPeriodChange={setSelectedPeriod}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="bg-[#ff8306] dark:bg-[#ff8800] rounded-2xl py-1.5 px-3 shadow-sm flex items-center justify-between">
          <span className="text-xs font-medium text-white">资产</span>
          {isAmountHidden ? (
            <span className="text-lg font-SF text-white leading-tight">****</span>
          ) : (
            <span className="text-lg font-SF text-white leading-tight">
              {formatLargeNumber(convertedTotalAssets)}
            </span>
          )}
        </div>
        <div className="bg-[#ff8306] dark:bg-[#ff8800] rounded-2xl py-1.5 px-3 shadow-sm flex items-center justify-between">
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
          <ChartView
            mode="expanded"
            period={selectedPeriod}
            totalValue={convertedNetWorth}
            currencySymbol={symbol}
            todayProfit={convertedProfit}
            onPeriodChange={setSelectedPeriod}
            onHoverValueChange={handleHoverValue}
            onClose={handleClose}
          />
        </div>
      )}
    </div>
  );
}