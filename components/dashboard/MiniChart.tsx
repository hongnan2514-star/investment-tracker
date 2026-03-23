// components/dashboard/MiniChart.tsx
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { getCurrentUserId, getAssets } from '@/src/utils/assetStorage';
import { useCurrency } from '@/src/services/currency';
import { eventBus } from '@/src/utils/eventBus';

type Period = '1W' | '1M' | '6M';

interface Props {
  period: Period;
  totalValue: number;
  currencySymbol: string;
  profit: number;
  onClick: () => void;
}

const cache = new Map<string, { data: { value: number }[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export default function MiniChart({ period, totalValue, currencySymbol, profit, onClick }: Props) {
  const [chartData, setChartData] = useState<{ value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const { currency } = useCurrency();
  const lineColor = profit >= 0 ? '#22c55e' : '#ef4444';
  const cacheKey = `${period}_${currency}`;

  const fetchData = async (force = false) => {
    const cached = cache.get(cacheKey);
    const now = Date.now();
    if (!force && cached && (now - cached.timestamp) < CACHE_TTL) {
      setChartData(cached.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const userId = getCurrentUserId();
      if (!userId) throw new Error('用户未登录');
      const assets = getAssets();
      const res = await fetch('/api/snapshot/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, period, targetCurrency: currency, assets }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      let rawData: { timestamp: number; value: number }[] = json.data || [];

      const uniqueData = rawData.filter((point, index, self) =>
        index === 0 || point.timestamp !== self[index-1].timestamp
      );

      let finalData = uniqueData; // 无需切片

      if (finalData.length < 2) {
        const nowTs = Date.now();
        const currentValue = totalValue;
        finalData.push({ timestamp: nowTs, value: currentValue });
        finalData.sort((a, b) => a.timestamp - b.timestamp);
      }

      const values = finalData.map(p => ({ value: p.value }));
      setChartData(values);
      cache.set(cacheKey, { data: values, timestamp: now });
    } catch (err) {
      console.error('迷你图加载错误:', err);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = eventBus.subscribe('assetsUpdated', () => {
      cache.clear();
      fetchData(true);
    });
    fetchData();
    return () => unsubscribe();
  }, [period, currency, totalValue]);

  const getYAxisDomain = (): [number, number] => {
    if (chartData.length === 0) return [0, totalValue || 100];
    const values = chartData.map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) return [min - 1, min + 1];
    return [min, max];
  };

  // 定义光晕滤镜
  const glowFilter = (
    <filter id="miniGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );

  return (
    <div
      className="w-24 h-12 mb-2 cursor-pointer hover:opacity-80 transition active:scale-95"
      onClick={onClick}
      tabIndex={-1}
      style={{
        outline: 'none',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {loading || chartData.length < 2 ? (
        <div className="w-full h-full" />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <defs>{glowFilter}</defs>
            <YAxis domain={getYAxisDomain()} hide={true} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={2}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              filter="url(#miniGlow)"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
