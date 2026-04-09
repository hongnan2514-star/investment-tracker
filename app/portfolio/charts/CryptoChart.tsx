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
  costPrice?: number; // 成本价，用于持有以来走势的第一个点
}

export default function CryptoChart({ symbol, changePercent, purchaseDate, costPrice }: CryptoChartProps) {
  const [range, setRange] = useState<ChartRange>('15m');
  const [data, setData] = useState<{ date: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const getRequestParams = (range: ChartRange): { apiRange: string; limit: number; isSinceHolding: boolean } => {
    switch (range) {
      case '15m':
        return { apiRange: '15m', limit: 95, isSinceHolding: false };
      case '1d':   // 代表“1周”按钮
        return { apiRange: '1h', limit: 168, isSinceHolding: false };
      case '1M':
        return { apiRange: '6h', limit: 120, isSinceHolding: false };
      case 'since_holding':
        return { apiRange: 'since_holding', limit: 0, isSinceHolding: true };
      default:
        return { apiRange: '15m', limit: 95, isSinceHolding: false };
    }
  };

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let isCurrent = true;

    const fetchData = async () => {
      setLoading(true);
      setData([]);
      try {
        const { apiRange, limit, isSinceHolding } = getRequestParams(range);
        let url: string;
        if (isSinceHolding && purchaseDate) {
          url = `/api/history?symbol=${encodeURIComponent(symbol)}&type=crypto&range=since_holding&startDate=${purchaseDate}`;
        } else {
          url = `/api/history?symbol=${encodeURIComponent(symbol)}&type=crypto&range=${apiRange}&limit=${limit}`;
        }
        const res = await fetch(url, { signal: controller.signal });
        const json = await res.json();
        if (isCurrent && json.success && json.data?.length > 0) {
          let newData = json.data.map((item: any) => ({ date: item.date, value: item.value }));

          // 如果是持有以来且有成本价，插入第一个点
          if (isSinceHolding && costPrice !== undefined && purchaseDate) {
            const firstDate = newData.length > 0 ? newData[0].date : null;
            if (firstDate === purchaseDate) {
              // 替换当天价格为成本价
              newData[0] = { date: purchaseDate, value: costPrice };
            } else {
              // 在最前面插入成本价点（假设购买日期早于第一条数据）
              newData = [{ date: purchaseDate, value: costPrice }, ...newData];
            }
          }

          setData(newData);
        }
      } catch (error) {
        if (isCurrent && error instanceof Error && error.name !== 'AbortError') {
          console.error('获取加密货币历史数据失败', error);
        }
      } finally {
        if (isCurrent) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      controller.abort();
      isCurrent = false;
    };
  }, [symbol, range, purchaseDate, costPrice]);

  const strokeColor = changePercent != null
    ? changePercent >= 0 ? '#22c55e' : '#ef4444'
    : '#6b7280';

  return (
    <div className="flex flex-col h-full">
      {/* 按钮组 */}
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

      {/* 图表区域 */}
      <div className="flex-1 w-full min-h-0">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-gray-400" />
          </div>
        ) : data.length < 2 ? (
          <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
            暂无走势数据
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}