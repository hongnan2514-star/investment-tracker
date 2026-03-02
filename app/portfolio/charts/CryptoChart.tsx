// app/portfolio/charts/CryptoChart.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { Loader2 } from 'lucide-react';

export type ChartRange = '15m' | '1d' | '1M' | 'since_holding';

interface CryptoChartProps {
  symbol: string;
  changePercent: number | null;
  range: ChartRange;
  purchaseDate?: string;
}

export default function CryptoChart({ symbol, changePercent }: CryptoChartProps) {
  const [data, setData] = useState<{ value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // 取消上一次请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const fetchData = async () => {
      setLoading(true);
      setData([]);
      try {
        // 加密货币使用 15分钟线，40条数据
        const res = await fetch(
          `/api/history?symbol=${encodeURIComponent(symbol)}&type=crypto&range=15m&limit=40`,
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
  }, [symbol]);

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
  );
}