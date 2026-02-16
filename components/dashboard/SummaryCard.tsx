"use client";
import React, { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { getAssets } from '@/src/utils/assetStorage';
import { Asset } from '@/src/constants/types';
import { eventBus } from '@/src/utils/eventBus';
import { getHistoryData, HistoryPoint, recordSnapshot } from '@/src/services/historyService';
import ExpandedChart from './ExpandedChart';

const currencySymbolMap: Record<string, string> = {
  USD: '$',
  CNY: '¥',
};

export default function SummaryCard() {
  const [totalValue, setTotalValue] = useState<number>(0);
  const [todayProfit, setTodayProfit] = useState<number>(0);
  const [historyData, setHistoryData] = useState<HistoryPoint[]>([]);
  const [currency, setCurrency] = useState<string>("USD");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const formatLargeNumber = (num: number): string => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  const updateTotals = () => {
    const assets = getAssets();
    if (assets.length === 0) {
      setTotalValue(0);
      setTodayProfit(0);
      setCurrency('USD');
      return;
    }

    const total = assets.reduce((sum, asset) => sum + asset.marketValue, 0);
    const profit = assets.reduce((sum, asset) => {
      const assetProfit = asset.price * asset.holdings * (asset.changePercent || 0) / 100;
      return sum + assetProfit;
    }, 0);

    setTotalValue(total);
    setTodayProfit(profit);
    setCurrency(assets[0].currency);
  };

  const updateHistory = () => {
    const data = getHistoryData(24);
    setHistoryData(data);
  };

  useEffect(() => {
    recordSnapshot();
    updateTotals();
    updateHistory();

    const unsubscribeAssets = eventBus.subscribe('assetsUpdated', () => {
      updateTotals();
      updateHistory();
    });

    return () => unsubscribeAssets();
  }, []);

  useEffect(() => {
    const unsubscribeUser = eventBus.subscribe('userChanged', () => {
      updateTotals();
      updateHistory();
    });
    return () => unsubscribeUser();
  }, []);

  const getCurrencySymbol = () => currencySymbolMap[currency] || currency;

  const getYAxisDomain = (): [number, number] => {
    if (historyData.length === 0) return [0, totalValue || 100];
    const values = historyData.map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.1;
    return [Math.max(0, min - padding), max + padding];
  };

  const chartColor = todayProfit >= 0 ? '#22c55e' : '#ef4444';
  const profitSign = todayProfit > 0 ? '+' : todayProfit < 0 ? '-' : '';
  const profitColorClass = 
    todayProfit > 0 ? 'text-green-500' : 
    todayProfit < 0 ? 'text-red-500' : 'text-gray-500 dark:text-gray-400';

  const handleClose = () => {
    setIsClosing(true);
    // 动画结束后再真正关闭
    setTimeout(() => {
      setIsExpanded(false);
      setIsClosing(false);
    }, 300);
  };

  return (
    <div className="mb-6 px-2">
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
            <span className="text-xs font-semibold">总资产估值</span>
          </div>
          <div className="flex items-baseline gap-1">
            <h2 className="text-3xl font-black tracking-tight text-gray-900 dark:text-gray-100">
              {getCurrencySymbol()}{formatLargeNumber(totalValue)}
            </h2>
          </div>
          <p className={`text-sm font-bold mt-2 ${profitColorClass}`}>
            今日收益 {profitSign}{getCurrencySymbol()}{formatLargeNumber(Math.abs(todayProfit))}
            {totalValue > 0 && (
              <> ({profitSign}{(todayProfit / totalValue * 100).toFixed(2)}%)</>
            )}
          </p >
        </div>

        {/* 迷你走势图 - 仅在未展开且未关闭动画时显示 */}
        {!isExpanded && !isClosing && (
          <div
            className="w-24 h-12 mb-2 cursor-pointer hover:opacity-80 transition active:scale-95"
            onClick={() => setIsExpanded(true)}
          >
            {historyData.length < 2 ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
                暂无数据
              </div>
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

      {/* 展开区域 - 使用动画控制显隐和滑入滑出 */}
      {(isExpanded || isClosing) && (
        <div
          className={`mt-6 border-t border-gray-100 dark:border-gray-800 pt-6 transition-all duration-300 ease-in-out transform ${
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
            totalValue={totalValue} 
            currencySymbol={getCurrencySymbol()} 
            todayProfit={todayProfit}
            onClose={handleClose}
          />
        </div>
      )}
    </div>
  );
}