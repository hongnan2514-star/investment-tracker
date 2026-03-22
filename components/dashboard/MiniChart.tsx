"use client";
import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { getCurrentUserId, getAssets } from '@/src/utils/assetStorage';
import { useCurrency } from '@/src/services/currency';
import { eventBus } from '@/src/utils/eventBus';

type Period = '1D' | '1W' | '1M' | '6M';

interface Props {
  period: Period;
  totalValue: number;
  currencySymbol: string;
  profit: number;
  onClick: () => void;
}

// 缓存数据，键为 `${period}_${currency}`
const cache = new Map<string, { data: { value: number }[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟（可根据需要调整）

export default function MiniChart({ period, totalValue, currencySymbol, profit, onClick }: Props) {
  const [chartData, setChartData] = useState<{ value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const { currency } = useCurrency();
  const lineColor = profit >= 0 ? '#22c55e' : '#ef4444';
  const cacheKey = `${period}_${currency}`;
  const assetsVersionRef = useRef<string>(JSON.stringify(getAssets())); // 用于监听资产变化

  const fetchData = async (force = false) => {
    // 检查缓存
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

      // 去重
      const uniqueData = rawData.filter((point, index, self) =>
        index === 0 || point.timestamp !== self[index-1].timestamp
      );

      let finalData = period === '1D' ? uniqueData.slice(-24) : uniqueData;

      // 确保至少两个点
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
  return () => unsubscribe(); // ✅ 正确
}, [period, currency, totalValue]); // 注意 totalValue 变化也可能由汇率引起，但汇率变化时货币已变，缓存键会变

  const getYAxisDomain = (): [number, number] => {
    if (chartData.length === 0) return [0, totalValue || 100];
    const values = chartData.map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) return [min - 1, min + 1];
    return [min, max];
  };

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
            <YAxis domain={getYAxisDomain()} hide={true} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={2}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}