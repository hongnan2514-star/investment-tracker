"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { getAssets } from '@/src/utils/assetStorage';
import { Asset } from '@/src/constants/types';
import { eventBus } from '@/src/utils/eventBus';
import { getHistoryData, HistoryPoint, recordSnapshot } from '@/src/services/historyService';
import ExpandedChart from './ExpandedChart';
import { useCurrency, useCurrencyConverter } from '@/src/services/currency';

export default function SummaryCard() {
  const [convertedTotalAssets, setConvertedTotalAssets] = useState<number>(0);
  const [convertedTotalLiabilities, setConvertedTotalLiabilities] = useState<number>(0);
  const [convertedNetWorth, setConvertedNetWorth] = useState<number>(0);
  const [convertedProfit, setConvertedProfit] = useState<number>(0);
  const [historyData, setHistoryData] = useState<HistoryPoint[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const { currency, symbol } = useCurrency();
  const { convert, loading } = useCurrencyConverter();

  const formatLargeNumber = (num: number): string => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  // 核心刷新函数：重新获取资产，按各自货币转换，并计算汇总值
  const refreshData = useCallback(async () => {
    const assets = getAssets() as Asset[];
    let assetsSum = 0;
    let liabilitiesSum = 0;
    let profitSum = 0;

    // 并行转换所有资产
    await Promise.all(
      assets.map(async (asset) => {
        const fromCurrency = asset.currency || 'USD';
        // 转换市值
        const convertedValue = await convert(asset.marketValue, fromCurrency as any, currency);
        if (asset.type === 'liability') {
          liabilitiesSum += Math.abs(convertedValue); // 负债取绝对值累加
        } else {
          assetsSum += convertedValue;
        }

        // 转换今日收益（如果有）
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

  // 更新历史数据
  const updateHistory = useCallback(() => {
    const data = getHistoryData(24);
    setHistoryData(data);
  }, []);

  // 初始化、资产更新、货币变化时刷新数据
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

  const getYAxisDomain = (): [number, number] => {
    if (historyData.length === 0) return [0, convertedNetWorth || 100];
    const values = historyData.map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.1;
    return [Math.max(0, min - padding), max + padding];
  };

  const chartColor = convertedProfit >= 0 ? '#22c55e' : '#ef4444';
  const profitSign = convertedProfit > 0 ? '+' : convertedProfit < 0 ? '-' : '';
  const profitColorClass = 
    convertedProfit > 0 ? 'text-green-500' : 
    convertedProfit < 0 ? 'text-red-500' : 'text-gray-500 dark:text-gray-400';

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsExpanded(false);
      setIsClosing(false);
    }, 300);
  };

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
          <div
            className="w-24 h-12 mb-2 cursor-pointer hover:opacity-80 transition active:scale-95"
            onClick={() => setIsExpanded(true)}
          >
            {historyData.length < 2 ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 dark:text-gray-500" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyData.map(p => ({ pv: p.value }))}>
                  <YAxis domain={getYAxisDomain()} hide={true} />
                  <Line
                    type="monotone"
                    dataKey="pv"
                    stroke={chartColor}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>

      {/* 资产与负债卡片 - 颜色已改为橙色，可自行调整 */}
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
          />
        </div>
      )}
    </div>
  );
}