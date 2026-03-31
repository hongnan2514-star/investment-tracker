// app/portfolio/charts/MetalChart.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { Loader2 } from 'lucide-react';

export type MetalChartRange = '1M' | '6M' | '1Y' | 'since_holding';

interface MetalChartProps {
  symbol: string;
  changePercent: number | null;
  purchaseDate?: string;
  costPrice?: number;
  currentPrice?: number; // 用于计算盈亏
}

export default function MetalChart({ 
  symbol, 
  changePercent, 
  purchaseDate, 
  costPrice,
  currentPrice 
}: MetalChartProps) {
  const [range, setRange] = useState<MetalChartRange>('1M');
  const [data, setData] = useState<{ date: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 根据 range 获取请求参数
  const getRequestParams = (range: MetalChartRange): { days?: number; startDate?: string } => {
    switch (range) {
      case '1M':
        return { days: 30 };
      case '6M':
        return { days: 180 };
      case '1Y':
        return { days: 365 };
      case 'since_holding':
        return { startDate: purchaseDate };
      default:
        return { days: 30 };
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
        const params = getRequestParams(range);
        let url: string;
        if ('startDate' in params && params.startDate) {
          url = `/api/metal/history?code=${encodeURIComponent(symbol)}&startDate=${params.startDate}`;
        } else {
          url = `/api/metal/history?code=${encodeURIComponent(symbol)}&days=${params.days}`;
        }

        const res = await fetch(url, { signal: controller.signal });
        const json = await res.json();

        if (isCurrent && json.success && json.data?.length > 0) {
          let newData = json.data.map((item: any) => ({ date: item.date, value: item.value }));

          // 如果是持有以来且有成本价，在第一个点插入成本价
          if (range === 'since_holding' && costPrice !== undefined && purchaseDate) {
            const firstDate = newData.length > 0 ? newData[0].date : null;
            if (firstDate === purchaseDate) {
              newData[0] = { date: purchaseDate, value: costPrice };
            } else {
              newData = [{ date: purchaseDate, value: costPrice }, ...newData];
            }
          }

          // 如果只有一条数据，构造辅助点以显示水平线
          if (newData.length === 1) {
            const single = newData[0];
            const nextDate = new Date(single.date);
            nextDate.setDate(nextDate.getDate() + 1);
            newData = [
              single,
              { date: nextDate.toISOString().split('T')[0], value: single.value }
            ];
            console.log('[MetalChart] 仅有一条数据，构造辅助点');
          }

          setData(newData);
        } else if (isCurrent) {
          setData([]);
        }
      } catch (error) {
        if (isCurrent && error instanceof Error && error.name !== 'AbortError') {
          console.error('获取贵金属历史数据失败', error);
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

  // 根据盈亏确定线条颜色
  let profitPercent = 0;
  if (costPrice && costPrice > 0 && currentPrice) {
    profitPercent = ((currentPrice - costPrice) / costPrice) * 100;
  }
  const strokeColor = profitPercent > 0 ? '#22c55e' : profitPercent < 0 ? '#ef4444' : '#6b7280';

  return (
    <div className="flex flex-col h-full">
      {/* 按钮组 */}
      <div className="flex justify-between px-2 mb-2">
        {(['1M', '6M', '1Y', 'since_holding'] as MetalChartRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              range === r
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {r === '1M' ? '1月' : r === '6M' ? '6月' : r === '1Y' ? '1年' : '持有以来'}
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