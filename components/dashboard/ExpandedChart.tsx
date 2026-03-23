// components/dashboard/ExpandedChart.tsx
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, ReferenceLine } from 'recharts';
import { Loader2, ChevronUp } from 'lucide-react';
import { getCurrentUserId, getAssets } from '@/src/utils/assetStorage';
import { useCurrency } from '@/src/services/currency';
import { eventBus } from '@/src/utils/eventBus';

type Period = '1W' | '1M' | '6M';

interface Props {
  totalValue: number;
  currencySymbol: string;
  todayProfit: number;
  onClose: () => void;
  period: Period;
  onPeriodChange: (period: Period) => void;
  onHoverValueChange: (value: number | null, timeStr?: string) => void;
}

const cache = new Map<string, { data: { time: string; value: number }[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export default function ExpandedChart({
  totalValue,
  currencySymbol,
  todayProfit,
  onClose,
  period,
  onPeriodChange,
  onHoverValueChange,
}: Props) {
  const [chartData, setChartData] = useState<{ time: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activePoint, setActivePoint] = useState<{ time: string; value: number; index: number } | null>(null);
  const mounted = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { currency } = useCurrency();
  const lineColor = todayProfit >= 0 ? '#22c55e' : '#ef4444';
  const cacheKey = `${period}_${currency}`;

  const fetchData = async (force = false) => {
    if (!mounted.current) return;
    // 取消之前的请求
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
        signal,
      });
      const json = await res.json();
      if (signal.aborted) return;
      if (json.error) throw new Error(json.error);
      let rawData: { timestamp: number; value: number }[] = json.data || [];

      const uniqueData = rawData.filter((p, i, arr) => i === 0 || p.timestamp !== arr[i - 1].timestamp);
      let finalData = uniqueData;
      if (finalData.length < 2) {
        const nowTs = Date.now();
        const currentValue = totalValue;
        finalData.push({ timestamp: nowTs, value: currentValue });
        finalData.sort((a, b) => a.timestamp - b.timestamp);
      }

      const formatted = finalData.map((p) => ({
        time: new Date(p.timestamp).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
        value: p.value,
      }));
      if (mounted.current && !signal.aborted) {
        setChartData(formatted);
        cache.set(cacheKey, { data: formatted, timestamp: now });
      }
    } catch (err: any) {
      if (signal.aborted) return;
      if (mounted.current) setError(err.message || '加载失败');
    } finally {
      if (mounted.current && !signal.aborted) setLoading(false);
    }
  };

  const handleMouseMove = (state: any) => {
    if (state && typeof state.activeTooltipIndex === 'number' && state.activePayload?.length) {
      const payload = state.activePayload[0].payload;
      const index = state.activeTooltipIndex;
      const time = state.activeLabel || payload.time;
      const value = payload.value;
      setActivePoint({ time, value, index });
      onHoverValueChange(value, time);
    }
  };

  const handleMouseLeave = () => {
    setActivePoint(null);
    onHoverValueChange(null);
  };

  useEffect(() => {
    const unsubscribe = eventBus.subscribe('assetsUpdated', () => {
      cache.clear();
      fetchData();
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    mounted.current = true;
    fetchData();
    return () => {
      mounted.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [period, currency, totalValue]);

  const getYAxisDomain = (): [number, number] => {
    if (chartData.length === 0) return [0, totalValue || 100];
    const values = chartData.map((p) => p.value);
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
    '1W': '1周',
    '1M': '1月',
    '6M': '6月',
  };

  const RightMask =
    activePoint && activePoint.index !== undefined && activePoint.index < chartData.length - 1 ? (
      <div
        className="absolute top-0 bottom-0 pointer-events-none bg-black/30 dark:bg-white/20"
        style={{
          left: `${((activePoint.index + 1) / chartData.length) * 100}%`,
          right: 0,
          zIndex: 10,
        }}
      />
    ) : null;

  return (
    <div className="w-full relative">
      <div className="h-64 w-full relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50 z-20">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-red-500 z-20">
            {error}
          </div>
        )}
        {!loading && !error && chartData.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            暂无足够历史数据
          </div>
        )}
        {!loading && !error && chartData.length > 0 && (
          <>
            {RightMask}
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                <defs>{glowFilter}</defs>
                <XAxis dataKey="time" hide={true} />
                <YAxis domain={getYAxisDomain()} hide={true} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={lineColor}
                  strokeWidth={2}
                  dot={false}
                  filter="url(#glow)"
                  isAnimationActive={false}
                  activeDot={{ r: 4, stroke: lineColor, strokeWidth: 2, fill: 'white' }}
                />
                {activePoint && (
                  <ReferenceLine
                    x={activePoint.time}
                    stroke={lineColor}
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    label={{
                      value: activePoint.time,
                      position: 'top',
                      fill: lineColor,
                      fontSize: 12,
                      fontWeight: 'bold',
                      offset: 10,
                    }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      <div className="flex justify-between gap-2 mt-4">
        {(['1W', '1M', '6M'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => onPeriodChange(p)}
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