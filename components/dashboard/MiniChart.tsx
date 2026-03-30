// components/dashboard/MiniChart.tsx
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { getCurrentUserId } from '@/src/utils/assetStorage';
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
const CACHE_TTL = 15 * 60 * 1000;

export default function MiniChart({ period, totalValue, currencySymbol, profit, onClick }: Props) {
  const [chartData, setChartData] = useState<{ value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const { currency } = useCurrency();
  const lineColor = profit >= 0 ? '#22c55e' : '#ef4444';
  const cacheKey = `${period}_${currency}`;
  const abortControllerRef = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const fetchData = async (force = false) => {
    if (!mounted.current) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    const cached = cache.get(cacheKey);
    const now = Date.now();
    if (!force && cached && now - cached.timestamp < CACHE_TTL) {
      setChartData(cached.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const userId = getCurrentUserId();
      if (!userId) throw new Error('用户未登录');

      // 强制获取最新资产列表（与 ExpandedChart 保持一致）
      const assetsRes = await fetch('/api/asset', {
        headers: { 'x-user-id': userId },
        cache: 'no-store',
      });
      if (!assetsRes.ok) throw new Error('获取资产列表失败');
      const freshAssets = await assetsRes.json();
      const normalizedAssets = freshAssets.map((asset: any) => ({
        ...asset,
        price: Number(asset.price),
        holdings: Number(asset.holdings),
        marketValue: Number(asset.marketValue),
      }));

      const res = await fetch('/api/snapshot/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, period, targetCurrency: currency, assets: normalizedAssets }),
        signal,
      });
      if (signal.aborted) return;

      const json = await res.json();
      if (signal.aborted) return;
      if (json.error) throw new Error(json.error);

      let rawData: { timestamp: number; value: number }[] = json.data || [];

      // 去重
      const uniqueData = rawData.filter((p, i, arr) => i === 0 || p.timestamp !== arr[i-1].timestamp);

      let finalData = uniqueData;
      if (finalData.length < 2) {
        const nowTs = Date.now();
        finalData.push({ timestamp: nowTs, value: totalValue });
        finalData.sort((a, b) => a.timestamp - b.timestamp);
      }

      // 追加当前点（与 ExpandedChart 保持一致）
      let finalFormatted = finalData.map(p => ({ value: p.value }));
      if (period === '1W') {
        const nowTs = Date.now();
        const lastTimestamp = finalData[finalData.length - 1]?.timestamp;
        if (!lastTimestamp || (nowTs - lastTimestamp) > 60 * 60 * 1000) {
          finalFormatted = [...finalFormatted, { value: totalValue }];
        }
      } else {
        // 1M/6M：如果最后一天不是今天，追加今天点
        const lastDate = finalData.length > 0 ? new Date(finalData[finalData.length - 1].timestamp) : null;
        const nowDate = new Date();
        if (!lastDate || lastDate.toDateString() !== nowDate.toDateString()) {
          finalFormatted = [...finalFormatted, { value: totalValue }];
        }
      }

      setChartData(finalFormatted);
      cache.set(cacheKey, { data: finalFormatted, timestamp: now });
    } catch (err: any) {
      if (signal.aborted) return;
      console.error('迷你图加载错误:', err);
      setChartData([]);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    fetchData();
    return () => {
      mounted.current = false;
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [period, currency, totalValue]);

  useEffect(() => {
    const handleAssetsUpdate = () => {
      cache.clear();
      fetchData(true);
    };
    const unsubscribe = eventBus.subscribe('assetsUpdated', handleAssetsUpdate);
    return () => unsubscribe();
  }, []);

  const getYAxisDomain = (): [number, number] => {
    if (chartData.length === 0) return [0, totalValue || 100];
    const values = chartData.map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) return [min - 1, min + 1];
    return [min, max];
  };

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