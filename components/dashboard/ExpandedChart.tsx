// components/dashboard/ExpandedChart.tsx
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, Tooltip, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Loader2, ChevronUp } from 'lucide-react';
import { getCurrentUserId, getAssets } from '@/src/utils/assetStorage';
import { useCurrency } from '@/src/services/currency';
import { eventBus } from '@/src/utils/eventBus';

type Period = '1D' | '1W' | '1M' | '6M';

interface Props {
  totalValue: number;
  currencySymbol: string;
  todayProfit: number;
  onClose: () => void;
  period: Period;
  onPeriodChange: (period: Period) => void;
}

// 与迷你图共享缓存（也可独立，但使用相同键）
const cache = new Map<string, { data: { time: string; value: number }[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export default function ExpandedChart({ totalValue, currencySymbol, todayProfit, onClose, period, onPeriodChange }: Props) {
  const [chartData, setChartData] = useState<{ time: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);

  const { currency } = useCurrency();
  const lineColor = todayProfit >= 0 ? '#22c55e' : '#ef4444';
  const cacheKey = `${period}_${currency}`;

  const fetchData = async (force = false) => {
    if (!mounted.current) return;
    const cached = cache.get(cacheKey);
    const now = Date.now();
    if (!force && cached && (now - cached.timestamp) < CACHE_TTL) {
      setChartData(cached.data);
      return;
    }

    setLoading(true);
    setError('');
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

      let finalData = period === '1D' ? uniqueData.slice(-24) : uniqueData;

      if (finalData.length < 2) {
        const nowTs = Date.now();
        const currentValue = totalValue;
        finalData.push({ timestamp: nowTs, value: currentValue });
        finalData.sort((a, b) => a.timestamp - b.timestamp);
      }

      const formatted = finalData.map(p => ({
        time: period === '1D'
          ? new Date(p.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
          : new Date(p.timestamp).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
        value: p.value,
      }));
      if (mounted.current) {
        setChartData(formatted);
        cache.set(cacheKey, { data: formatted, timestamp: now });
      }
    } catch (err: any) {
      if (mounted.current) setError(err.message || '加载失败');
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  // 监听资产变化，清空缓存并强制刷新
  useEffect(() => {
    const unsubscribe = eventBus.subscribe('assetsUpdated', () => {
      cache.clear();
      fetchData(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    mounted.current = true;
    fetchData();
    return () => {
      mounted.current = false;
    };
  }, [period, currency]);

  // 当 totalValue 变化（如汇率转换）且是1D周期时，更新补点（但不重新请求整个历史）
  useEffect(() => {
    if (period === '1D') {
      const cached = cache.get(cacheKey);
      if (cached && cached.data.length > 0) {
        const newData = [...cached.data];
        const lastPoint = newData[newData.length - 1];
        const newValue = totalValue;
        if (lastPoint.value !== newValue) {
          const now = Date.now();
          const newTime = new Date(now).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
          newData[newData.length - 1] = { ...lastPoint, time: newTime, value: newValue };
          setChartData(newData);
          cache.set(cacheKey, { data: newData, timestamp: cached.timestamp });
        }
      } else {
        fetchData();
      }
    }
  }, [totalValue, period]);

  const getYAxisDomain = (): [number, number] => {
    if (chartData.length === 0) return [0, totalValue || 100];
    const values = chartData.map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) return [min - 1, min + 1];
    return [min, max];
  };

  const glowFilter = (
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );

  const periodLabels: Record<Period, string> = {
    '1D': '1日',
    '1W': '1周',
    '1M': '1月',
    '6M': '6月',
  };

  return (
    <div className="w-full">
      <div className="h-64 w-full">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-full text-red-500">
            {error}
          </div>
        )}
        {!loading && !error && chartData.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400">
            暂无足够历史数据
          </div>
        )}
        {!loading && !error && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>{glowFilter}</defs>
              <XAxis dataKey="time" hide={true} />
              <YAxis domain={getYAxisDomain()} hide={true} />
              <Tooltip
                formatter={(value: any) => {
                  const numValue = typeof value === 'number' ? value : 0;
                  return [`${currencySymbol}${numValue.toFixed(2)}`, '净资产'];
                }}
                labelFormatter={(label) => `时间: ${label}`}
                contentStyle={{
                  backgroundColor: '#1f2937',
                  color: '#f9fafb',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 12px',
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={lineColor}
                strokeWidth={2}
                dot={false}
                filter="url(#glow)"
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="flex justify-between gap-2 mt-4">
        {(['1D', '1W', '1M', '6M'] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => {
              onPeriodChange(p);
            }}
            className={`px-3 py-1.5 text-sm font-bold transition rounded-full ${
              period === p
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                : 'bg-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {periodLabels[p]}
          </button>
        ))}
      </div>

      <div className="flex justify-center mt-4">
        <button
          onClick={onClose}
          className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          aria-label="收起"
        >
          <ChevronUp size={20} />
        </button>
      </div>
    </div>
  );
}