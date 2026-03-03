// app/portfolio/charts/CryptoChart.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { Loader2 } from 'lucide-react';

export type ChartRange = '15m' | '1d' | '1M' | 'since_holding';

interface CryptoChartProps {
  symbol: string;
  changePercent: number | null;
  purchaseDate?: string;
}

export default function CryptoChart({ symbol, changePercent, purchaseDate }: CryptoChartProps) {
  const [range, setRange] = useState<ChartRange>('15m');
  const [data, setData] = useState<{ value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const getRequestParams = (range: ChartRange): { apiRange: string; limit: number } => {
    switch (range) {
      case '15m':
        return { apiRange: '15m', limit: 95 };      // 95条15分钟线 ≈ 1天
      case '1d':
        return { apiRange: '1h', limit: 24 };      // 168条1小时线 = 7天（1周）
      case '1M':
        return { apiRange: '1d', limit: 30 };       // 30条日线 ≈ 1个月
      case 'since_holding':
        return { apiRange: '1d', limit: 90 };       // 90条日线 ≈ 3个月
      default:
        return { apiRange: '15m', limit: 95 };
    }
  };

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const fetchData = async () => {
      setLoading(true);
      setData([]);
      try {
        const { apiRange, limit } = getRequestParams(range);
        const res = await fetch(
          `/api/history?symbol=${encodeURIComponent(symbol)}&type=crypto&range=${apiRange}&limit=${limit}`,
          { signal: controller.signal }
        );
        const json = await res.json();
        if (json.success && json.data?.length > 0) {
          setData(json.data.map((item: any) => ({ value: item.value })));
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('获取加密货币历史数据失败', error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      controller.abort();
    };
  }, [symbol, range, purchaseDate]);

  const strokeColor = changePercent != null
    ? changePercent >= 0 ? '#22c55e' : '#ef4444'
    : '#6b7280';

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  if (data.length < 2) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
        暂无走势数据
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 按钮组 - 等间距均匀排列 */}
      <div className="flex justify-between px-2 mb-2">
        {(['15m', '1d', '1M', 'since_holding'] as ChartRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              range === r
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {r === '15m' ? '1日' : r === '1d' ? '1周' : r === '1M' ? '1月' : '持有以来'}
          </button>
        ))}
      </div>
      {/* 走势图容器 */}
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <YAxis domain={['auto', 'auto']} hide={true} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={strokeColor}
              strokeWidth={2}
              dot={false}
              filter="url(#glow)"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}