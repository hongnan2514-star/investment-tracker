// components/dashboard/SummaryCard.tsx
"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { getAssets } from '@/src/utils/assetStorage';
import { Asset } from '@/src/constants/types';
import { eventBus } from '@/src/utils/eventBus';
import { getHistoryData, HistoryPoint, recordSnapshot } from '@/src/services/historyService';
import ExpandedChart from './ExpandedChart';
import MiniChart from './MiniChart';
import { useCurrency, useCurrencyConverter } from '@/src/services/currency';

type Period = '1D' | '1W' | '1M' | '6M';

export default function SummaryCard() {
  const [convertedTotalAssets, setConvertedTotalAssets] = useState<number>(0);
  const [convertedTotalLiabilities, setConvertedTotalLiabilities] = useState<number>(0);
  const [convertedNetWorth, setConvertedNetWorth] = useState<number>(0);
  const [convertedProfit, setConvertedProfit] = useState<number>(0);
  const [historyData, setHistoryData] = useState<HistoryPoint[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('1D'); // 共享周期

  const { currency, symbol } = useCurrency();
  const { convert, loading } = useCurrencyConverter();

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

    await Promise.all(
      assets.map(async (asset) => {
        const fromCurrency = asset.currency || 'USD';
        const convertedValue = await convert(asset.marketValue, fromCurrency as any, currency);
        if (asset.type === 'liability') {
          liabilitiesSum += Math.abs(convertedValue);
        } else {
          assetsSum += convertedValue;
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
  }, [currency, convert]);

  const updateHistory = useCallback(() => {
    const data = getHistoryData(24);
    setHistoryData(data);
  }, []);

  useEffect(() => {
    recordSnapshot();
    refreshData();
    updateHistory();

    const unsubscribeAssets = eventBus.subscribe('assetsUpdated', () => {
      refreshData();
      updateHistory();
    });

    const unsubscribeUser = eventBus.subscribe('userChanged', () => {
      refreshData();
      updateHistory();
    });

    return () => {
      unsubscribeAssets();
      unsubscribeUser();
    };
  }, [refreshData, updateHistory]);

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

  return (
    <div className="mb-6 px-2">
      {/* 净资产估值区域 */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
            <span className="text-xs font-semibold">净资产估值</span>
            {loading && <span className="text-xs text-blue-500 animate-pulse">汇率更新中...</span>}
          </div>
          <div className="flex items-baseline gap-1">
            <h2 className="text-3xl font-black tracking-tight text-gray-900 dark:text-gray-100 inline-flex items-baseline gap-1">
              <span>{formatLargeNumber(convertedNetWorth)}</span>
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">{currency}</span>
            </h2>
          </div>
          <p className="text-sm font-bold mt-2">
            <span className="text-gray-400 dark:text-gray-400">今日收益</span>{' '}
            <span className={profitColorClass}>
              {profitSign}{symbol}{formatLargeNumber(Math.abs(convertedProfit))}
              {convertedNetWorth > 0 && (
                <> ({profitSign}{(convertedProfit / convertedNetWorth * 100).toFixed(2)}%)</>
              )}
            </span>
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
          <span className="text-lg font-SF text-white leading-tight">
            {formatLargeNumber(convertedTotalAssets)}
          </span>
        </div>
        <div className="bg-[#ff8800] dark:bg-[#ff8800] rounded-2xl py-1.5 px-3 shadow-sm flex items-center justify-between">
          <span className="text-xs font-medium text-white">负债</span>
          <span className="text-lg font-SF text-white leading-tight">
            -{formatLargeNumber(convertedTotalLiabilities)}
          </span>
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
          />
        </div>
      )}
    </div>
  );
}