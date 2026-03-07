// app/portfolio/charts/StockChart.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { Loader2 } from 'lucide-react';

// 与 CryptoChart 保持相同的 ChartRange 类型
export type ChartRange = '15m' | '1d' | '1M' | 'since_holding';

interface StockChartProps {
  symbol: string;
  changePercent: number | null;
  purchaseDate?: string;    // 购买日期，用于“持有以来”
  costPrice?: number;       // 成本价，用于“持有以来”第一个点
}

export default function StockChart({ 
  symbol, 
  changePercent, 
  purchaseDate, 
  costPrice 
}: StockChartProps) {
  const [range, setRange] = useState<ChartRange>('15m');  // 默认 1日
  const [data, setData] = useState<{ date?: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 根据 range 转换为 API 参数
  const getRequestParams = (range: ChartRange): { apiRange: string; limit: number; isSinceHolding: boolean } => {
    switch (range) {
      case '15m':  // 1日 → 15分钟粒度，95个点 ≈ 24小时
        return { apiRange: '15m', limit: 75, isSinceHolding: false };
      case '1d':   // 1周 → 1小时粒度，168个点 = 7天
        return { apiRange: '1h', limit: 35, isSinceHolding: false };
      case '1M':   // 1月 → 1天粒度，30个点 = 30天
        return { apiRange: '1h', limit: 150, isSinceHolding: false };
      case 'since_holding':  // 持有以来
        return { apiRange: 'since_holding', limit: 0, isSinceHolding: true };
      default:
        return { apiRange: '15m', limit: 95, isSinceHolding: false };
    }
  };

  useEffect(() => {
    // 取消上一个请求
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
          // 持有以来：需要 startDate 参数
          url = `/api/history?symbol=${encodeURIComponent(symbol)}&type=stock&range=since_holding&startDate=${purchaseDate}`;
        } else {
          // 普通范围：使用对应的 range 和 limit
          url = `/api/history?symbol=${encodeURIComponent(symbol)}&type=stock&range=${apiRange}&limit=${limit}`;
        }

        const res = await fetch(url, { signal: controller.signal });
        const json = await res.json();

        if (isCurrent && json.success && json.data?.length > 0) {
          let newData = json.data.map((item: any) => ({ 
            date: item.date, 
            value: item.value 
          }));

          // 如果是持有以来且有成本价，在第一个点插入成本价
          if (isSinceHolding && costPrice !== undefined && purchaseDate) {
            const firstDate = newData.length > 0 ? newData[0].date : null;
            if (firstDate === purchaseDate) {
              // 如果第一条数据日期等于购买日期，替换其值为成本价
              newData[0] = { date: purchaseDate, value: costPrice };
            } else {
              // 否则在最前面插入成本价点
              newData = [{ date: purchaseDate, value: costPrice }, ...newData];
            }
          }

          // 对于非持有以来的分钟/小时数据，可能需要反转（后端可能返回降序）
          // 这里根据实际需要决定是否反转，加密货币组件中做了反转，股票可按需调整
          // 如果不确定，可以先不反转，观察数据顺序
          // if (!isSinceHolding) newData.reverse();

          setData(newData);
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

      {/* 走势图 */}
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