"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { getAssets } from '@/src/utils/assetStorage';
import { Asset } from '@/src/constants/types';
import { eventBus } from '@/src/utils/eventBus';
import { getHistoryData, HistoryPoint, recordSnapshot } from '@/src/services/historyService';
import ExpandedChart from './ExpandedChart';
import { useCurrency, useCurrencyConverter } from '@/src/services/currency'; // 新增导入

export default function SummaryCard() {
  const [totalValue, setTotalValue] = useState<number>(0);          // 原始总值（默认 USDT）
  const [todayProfit, setTodayProfit] = useState<number>(0);        // 原始收益（默认 USDT）
  const [convertedTotal, setConvertedTotal] = useState<number>(0);  // 转换后总值
  const [convertedProfit, setConvertedProfit] = useState<number>(0); // 转换后收益
  const [historyData, setHistoryData] = useState<HistoryPoint[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const { currency, symbol } = useCurrency();                // 获取当前货币和符号
  const { convert, loading } = useCurrencyConverter();       // 转换函数和加载状态

  const formatLargeNumber = (num: number): string => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  // 更新原始数据（假设资产以 USDT 计价）
  const updateTotals = useCallback(() => {
    const assets = getAssets();
    if (assets.length === 0) {
      setTotalValue(0);
      setTodayProfit(0);
      return;
    }

    const total = assets.reduce((sum, asset) => sum + asset.marketValue, 0);
    const profit = assets.reduce((sum, asset) => {
      const assetProfit = asset.price * asset.holdings * (asset.changePercent || 0) / 100;
      return sum + assetProfit;
    }, 0);

    setTotalValue(total);
    setTodayProfit(profit);
  }, []);

  // 当原始数据或货币变化时，重新转换金额
  useEffect(() => {
    const convertValues = async () => {
      // 假设原始资产以 USDT 计价
      const [newTotal, newProfit] = await Promise.all([
        convert(totalValue, 'USDT', currency),
        convert(todayProfit, 'USDT', currency),
      ]);
      setConvertedTotal(newTotal);
      setConvertedProfit(newProfit);
    };
    convertValues();
  }, [totalValue, todayProfit, currency, convert]);

  const updateHistory = useCallback(() => {
    const data = getHistoryData(24);
    setHistoryData(data);
  }, []);

  useEffect(() => {
    recordSnapshot();
    updateTotals();
    updateHistory();

    const unsubscribeAssets = eventBus.subscribe('assetsUpdated', () => {
      updateTotals();
      updateHistory();
    });

    return () => unsubscribeAssets();
  }, [updateTotals, updateHistory]);

  useEffect(() => {
    const unsubscribeUser = eventBus.subscribe('userChanged', () => {
      updateTotals();
      updateHistory();
    });
    return () => unsubscribeUser();
  }, [updateTotals, updateHistory]);

  const getYAxisDomain = (): [number, number] => {
    if (historyData.length === 0) return [0, convertedTotal || 100];
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
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
            <span className="text-xs font-semibold">总资产估值</span>
            {loading && <span className="text-xs text-blue-500 animate-pulse">汇率更新中...</span>}
          </div>
          <div className="flex items-baseline gap-1">
            <h2 className="text-3xl font-black tracking-tight text-gray-900 dark:text-gray-100">
              {symbol}{formatLargeNumber(convertedTotal)}
            </h2>
          </div>
          <p className={`text-sm font-bold mt-2 ${profitColorClass}`}>
            今日收益 {profitSign}{symbol}{formatLargeNumber(Math.abs(convertedProfit))}
            {convertedTotal > 0 && (
              <> ({profitSign}{(convertedProfit / convertedTotal * 100).toFixed(2)}%)</>
            )}
          </p >
        </div>

        {/* 迷你走势图 */}
        {!isExpanded && !isClosing && (
          <div
            className="w-24 h-12 mb-2 cursor-pointer hover:opacity-80 transition active:scale-95"
            onClick={() => setIsExpanded(true)}
          >
            {historyData.length < 2 ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
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

      {/* 展开区域 */}
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
            totalValue={convertedTotal} 
            currencySymbol={symbol} 
            todayProfit={convertedProfit}
            onClose={handleClose}
          />
        </div>
      )}
    </div>
  );
}