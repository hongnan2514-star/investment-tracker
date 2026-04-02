// app/portfolio/charts/StockChart.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Loader2 } from 'lucide-react';

export type ChartRange = '1d' | '1M' | 'since_holding';

interface StockChartProps {
  symbol: string;
  changePercent: number | null;
  purchaseDate?: string;
  costPrice?: number;
}

export default function StockChart({
  symbol,
  changePercent,
  purchaseDate,
  costPrice
}: StockChartProps) {
  const [range, setRange] = useState<ChartRange>('1d');
  const [data, setData] = useState<{ date: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 获取历史数据
  const getRequestParams = (range: ChartRange): { apiRange: string; limit: number; isSinceHolding: boolean } => {
    const isHKStock = symbol.includes('.HK') || (/^\d{4,5}$/.test(symbol) && !/^\d{6}$/.test(symbol));
    const isAStock = symbol.includes('.SS') || symbol.includes('.SZ');
    switch (range) {
      case '1d':
        return { apiRange: '1h', limit: 168, isSinceHolding: false };
      case '1M':
        if (isHKStock) {
          return { apiRange: '1d_hk', limit: 30, isSinceHolding: false };
        } else if (isAStock) {
          return { apiRange: '1d_a', limit: 30, isSinceHolding: false };
        } else {
          return { apiRange: '4h', limit: 180, isSinceHolding: false };
        }
      case 'since_holding':
        return { apiRange: 'since_holding', limit: 0, isSinceHolding: true };
      default:
        return { apiRange: '1h', limit: 168, isSinceHolding: false };
    }
  };

  const filterDataByRange = (data: { date: string; value: number }[], range: ChartRange): { date: string; value: number }[] => {
    if (range === 'since_holding') return data;

    const now = new Date();
    let cutoffDate: Date;

    if (range === '1d') {
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      cutoffDate.setHours(0, 0, 0, 0);
    } else if (range === '1M') {
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      cutoffDate.setHours(0, 0, 0, 0);
    } else {
      return data;
    }

    const cutoffTimestamp = cutoffDate.getTime();
    const filtered = data.filter(item => new Date(item.date).getTime() >= cutoffTimestamp);
    return filtered;
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
          url = `/api/history?symbol=${encodeURIComponent(symbol)}&type=stock&range=since_holding&startDate=${purchaseDate}`;
        } else {
          url = `/api/history?symbol=${encodeURIComponent(symbol)}&type=stock&range=${apiRange}&limit=${limit}`;
        }

        const res = await fetch(url, { signal: controller.signal });
        const json = await res.json();

        if (isCurrent && json.success && json.data?.length > 0) {
          let newData = json.data.map((item: any) => ({
            date: item.date,
            value: item.value
          }));

          if (isSinceHolding && costPrice !== undefined && purchaseDate) {
            const firstDate = newData.length > 0 ? newData[0].date : null;
            if (firstDate === purchaseDate) {
              newData[0] = { date: purchaseDate, value: costPrice };
            } else {
              newData = [{ date: purchaseDate, value: costPrice }, ...newData];
            }
          }

          const filteredData = filterDataByRange(newData, range);
          setData(filteredData);
        } else if (isCurrent) {
          setData([]);
        }
      } catch (error) {
        if (isCurrent && error instanceof Error && error.name !== 'AbortError') {
          console.error('获取股票历史数据失败', error);
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
      {/* 时间范围按钮 */}
      <div className="flex justify-between px-2 mb-2">
        {(['1d', '1M', 'since_holding'] as ChartRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              range === r
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {r === '1d' ? '1周' : r === '1M' ? '1月' : '持有以来'}
          </button>
        ))}
      </div>

      {/* 图表区域 */}
      <div className="flex-1 w-full min-h-0">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
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
              <XAxis dataKey="date" hide={true} />
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