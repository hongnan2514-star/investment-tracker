// components/dashboard/ChartView.tsx
"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, ChevronUp } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { getCurrentUserId } from '@/src/utils/assetStorage';
import { useCurrency } from '@/src/services/currency';
import { eventBus } from '@/src/utils/eventBus';
import { chartCache, CHART_CACHE_TTL } from '@/src/utils/chartCache';

type Period = '1W' | '1M' | '6M';
type Mode = 'mini' | 'expanded';

interface Props {
  mode: Mode;
  totalValue: number;
  currencySymbol: string;
  todayProfit?: number;
  onClose?: () => void;
  period: Period;
  onPeriodChange: (period: Period) => void;
  onHoverValueChange?: (value: number | null, timeStr?: string) => void;
}

export default function ChartView({
  mode,
  totalValue,
  currencySymbol,
  todayProfit = 0,
  onClose,
  period,
  onPeriodChange,
  onHoverValueChange,
}: Props) {
  const [chartData, setChartData] = useState<{ time: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [maskLeftPercent, setMaskLeftPercent] = useState<number | null>(null);
  const [activePoint, setActivePoint] = useState<{ time: string; value: number; index: number } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const rafRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);

  const { currency } = useCurrency();
  const lineColor = todayProfit >= 0 ? '#22c55e' : '#ef4444';
  const cacheKey = `${period}_${currency}`;
  const margin = { top: 20, right: 20, left: 20, bottom: 20 };

  // ---------- 数据获取（统一逻辑，不再强制对齐实时净资产） ----------
  const fetchData = useCallback(async (force = false) => {
    if (!mounted.current) return;

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const currentRequestId = ++requestIdRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    const cached = chartCache.get(cacheKey);
    const now = Date.now();
    if (!force && cached && now - cached.timestamp < CHART_CACHE_TTL) {
      console.log(`[ChartView] 使用缓存，数据长度: ${cached.data.length}`);
      if (currentRequestId === requestIdRef.current) {
        setChartData(cached.data);
        setLoading(false);
      }
      return;
    }

    console.log(`[ChartView] 无缓存或已过期，开始请求`);
    setLoading(true);
    setError('');

    try {
      const userId = getCurrentUserId();
      if (!userId) throw new Error('用户未登录');

      // 强制获取最新资产列表
      const assetsRes = await fetch('/api/asset', {
        headers: { 'x-user-id': userId },
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
      const uniqueData = rawData.filter((p, i, arr) => i === 0 || p.timestamp !== arr[i - 1].timestamp);

      let finalData = uniqueData;
      // 数据不足两个点时，用当前净资产补一个点（仅用于占位，不是强制对齐）
      if (finalData.length < 2) {
        const nowTs = Date.now();
        finalData.push({ timestamp: nowTs, value: totalValue });
        finalData.sort((a, b) => a.timestamp - b.timestamp);
      }

      const isHourly = period === '1W';
      const formatted = finalData.map((p) => {
        const date = new Date(p.timestamp);
        let timeStr: string;
        if (isHourly) {
          timeStr = date.toLocaleString('zh-CN', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).replace(/\//g, '/');
        } else {
          timeStr = date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
        }
        return { time: timeStr, value: p.value };
      });

      // ✅ 关键：将格式化后的数据设置到 chartData 并更新缓存
      if (currentRequestId === requestIdRef.current && !signal.aborted) {
        setChartData(formatted);
        chartCache.set(cacheKey, { data: formatted, timestamp: now });
      }
    } catch (err: any) {
      if (signal.aborted) return;
      if (currentRequestId === requestIdRef.current) {
        setError(err.message || '加载失败');
      }
      console.error('[ChartView] 错误:', err);
    } finally {
      if (currentRequestId === requestIdRef.current && !signal.aborted) {
        setLoading(false);
      }
    }
  }, [period, currency, totalValue, cacheKey]);

  // ---------- 扩展图绘制逻辑（保持不变） ----------
  const drawChart = useCallback(() => {
    if (mode !== 'expanded') return;
    if (!canvasRef.current || !containerRef.current || chartData.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;
    if (width === 0 || height === 0) return;

    const values = chartData.map(p => p.value);
    let minY = Math.min(...values);
    let maxY = Math.max(...values);
    if (minY === maxY) {
      minY -= 1;
      maxY += 1;
    }
    const yRange = maxY - minY;

    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    const points = chartData.map((p, i) => {
      const x = margin.left + (i / (chartData.length - 1)) * plotWidth;
      const y = margin.top + plotHeight - ((p.value - minY) / yRange) * plotHeight;
      return { x, y, value: p.value, time: p.time };
    });

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const splitX = maskLeftPercent !== null ? margin.left + (maskLeftPercent / 100) * (width - margin.left - margin.right) : width;

    const drawSegment = (from: { x: number; y: number }, to: { x: number; y: number }, isRight: boolean) => {
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.globalAlpha = isRight ? 0.06 : 1;
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const p1Right = p1.x >= splitX;
      const p2Right = p2.x >= splitX;
      if (p1Right === p2Right) {
        drawSegment(p1, p2, p1Right);
      } else {
        const t = (splitX - p1.x) / (p2.x - p1.x);
        const intersectY = p1.y + (p2.y - p1.y) * t;
        const intersect = { x: splitX, y: intersectY };
        drawSegment(p1, intersect, p1Right);
        drawSegment(intersect, p2, p2Right);
      }
    }

    if (activePoint && maskLeftPercent !== null && points[activePoint.index]) {
      const point = points[activePoint.index];
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#9faac2ff';
      ctx.textAlign = 'center';
      const centerX = dimensions.width / 2;
      ctx.fillText(point.time, centerX, margin.top - 6);
      ctx.restore();
    }

    if (splitX < width) {
      ctx.save();
      ctx.globalAlpha = 0.04;
      const grad = ctx.createLinearGradient(splitX, 0, width, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(1, 'rgba(255,255,255,0.1)');
      ctx.fillStyle = grad;
      ctx.fillRect(splitX, 0, width - splitX, height);
      ctx.restore();
    }
  }, [chartData, dimensions, lineColor, maskLeftPercent, activePoint, margin, mode]);

  // 监听容器尺寸变化（仅扩展模式）
  useEffect(() => {
    if (mode !== 'expanded') return;
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [mode]);

  useEffect(() => {
    if (mode === 'expanded') drawChart();
  }, [drawChart, mode]);

  useEffect(() => {
    if (mode !== 'expanded') return;
    const handleResize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mode]);

  // 扩展图交互逻辑
  const handleInteraction = useCallback((clientX: number) => {
    if (mode !== 'expanded') return;
    if (!containerRef.current || chartData.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    let relativeX = (clientX - rect.left) / rect.width;
    relativeX = Math.min(Math.max(relativeX, 0), 1);
    const newMaskPercent = relativeX * 100;
    const index = Math.min(chartData.length - 1, Math.max(0, Math.floor(relativeX * chartData.length)));
    const point = chartData[index];
    const newActivePoint = { time: point.time, value: point.value, index };

    setMaskLeftPercent(newMaskPercent);
    setActivePoint(newActivePoint);
    onHoverValueChange?.(point.value, point.time);

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      drawChart();
      rafRef.current = null;
    });
  }, [chartData, onHoverValueChange, drawChart, mode]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => handleInteraction(e.clientX);
  const handleMouseLeave = () => {
    if (mode !== 'expanded') return;
    setActivePoint(null);
    setMaskLeftPercent(null);
    onHoverValueChange?.(null);
    drawChart();
  };
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (mode !== 'expanded') return;
    e.preventDefault();
    const touch = e.touches[0];
    if (touch) handleInteraction(touch.clientX);
  };
  const handleTouchEnd = () => {
    if (mode !== 'expanded') return;
    setActivePoint(null);
    setMaskLeftPercent(null);
    onHoverValueChange?.(null);
    drawChart();
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // 监听资产更新，清除缓存并重新获取
  useEffect(() => {
    const unsubscribe = eventBus.subscribe('assetsUpdated', () => {
      chartCache.clear();
      fetchData(true);
    });
    return () => unsubscribe();
  }, [fetchData]);

  // 监听周期或货币变化，重新获取数据
  useEffect(() => {
    mounted.current = true;
    fetchData();
    return () => {
      mounted.current = false;
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [period, currency, fetchData]);

  const periodLabels: Record<Period, string> = {
    '1W': '1周',
    '1M': '1月',
    '6M': '6月',
  };

  // 迷你图渲染
  if (mode === 'mini') {
    const miniData = chartData.map(item => ({ value: item.value }));
    const getYAxisDomain = () => {
      if (miniData.length === 0) return [0, totalValue || 100];
      const values = miniData.map(p => p.value);
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
        onClick={() => onPeriodChange(period)}
        tabIndex={-1}
        style={{
          outline: 'none',
          WebkitTapHighlightColor: 'transparent',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        {loading || miniData.length < 2 ? (
          <div className="w-full h-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={miniData}>
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

  // 扩展图渲染
  return (
    <div className="w-full relative">
      <div
        ref={containerRef}
        className="h-64 w-full relative cursor-crosshair touch-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchStart={(e) => e.preventDefault()}
      >
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
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ width: '100%', height: '100%' }}
          />
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

      {onClose && (
        <div className="flex justify-center mt-4">
          <button
            onClick={onClose}
            className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            aria-label="收起"
          >
            <ChevronUp size={20} />
          </button>
        </div>
      )}
    </div>
  );
}