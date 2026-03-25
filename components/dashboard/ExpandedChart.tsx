// components/dashboard/ExpandedChart.tsx
"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
}: Props): React.ReactElement {
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

  const { currency } = useCurrency();
  const lineColor = todayProfit >= 0 ? '#22c55e' : '#ef4444';
  const cacheKey = `${period}_${currency}`;

  // 边距配置（与 recharts 版本保持一致，避免曲线贴边）
  const margin = { top: 20, right: 20, left: 20, bottom: 20 };

  // ---------- 数据获取 ----------
  const fetchData = async (force = false) => {
    if (!mounted.current) return;
    if (abortControllerRef.current) abortControllerRef.current.abort();
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

  // ---------- Canvas 绘图 ----------
  const drawChart = useCallback(() => {
    if (!canvasRef.current || !containerRef.current || chartData.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;
    if (width === 0 || height === 0) return;

    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    // 可绘制区域（扣除边距）
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    if (plotWidth <= 0 || plotHeight <= 0) return;

    // 计算 Y 轴范围
    const values = chartData.map(p => p.value);
    let minY = Math.min(...values);
    let maxY = Math.max(...values);
    if (minY === maxY) {
      minY -= 1;
      maxY += 1;
    }
    const yRange = maxY - minY;

    // 将数据点映射到 Canvas 坐标（考虑边距）
    const points = chartData.map((p, i) => {
      const x = margin.left + (i / (chartData.length - 1)) * plotWidth;
      const y = margin.top + plotHeight - ((p.value - minY) / yRange) * plotHeight;
      return { x, y, value: p.value, time: p.time };
    });

    const splitX = maskLeftPercent !== null ? margin.left + (maskLeftPercent / 100) * plotWidth : width;

    // 绘制线段（分段，右侧半透明）
    const drawSegment = (from: { x: number; y: number }, to: { x: number; y: number }, isRight: boolean) => {
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      if (isRight) {
        ctx.save();
        ctx.globalAlpha = 0.06; // 右侧变淡，可调整数值
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;
        // 添加光晕效果（阴影）
        ctx.shadowBlur = 4;
        ctx.shadowColor = lineColor;
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 4;
        ctx.shadowColor = lineColor;
        ctx.stroke();
      }
    };

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const p1Right = p1.x >= splitX;
      const p2Right = p2.x >= splitX;

      if (p1Right === p2Right) {
        drawSegment(p1, p2, p1Right);
      } else {
        // 计算交点
        const t = (splitX - p1.x) / (p2.x - p1.x);
        const intersectY = p1.y + (p2.y - p1.y) * t;
        const intersect = { x: splitX, y: intersectY };
        drawSegment(p1, intersect, p1Right);
        drawSegment(intersect, p2, p2Right);
      }
    }

    // 绘制活动点与竖线（始终在顶部）
    if (activePoint && maskLeftPercent !== null && points[activePoint.index]) {
  const point = points[activePoint.index];

  // 绘制竖线（虚线）
  ctx.beginPath();
ctx.moveTo(point.x, margin.top);
ctx.lineTo(point.x, height - margin.bottom);
ctx.strokeStyle = '#9ca3af';   // 改为灰色
ctx.setLineDash([4, 4]);
ctx.lineWidth = 1.5;
ctx.stroke();
ctx.setLineDash([]);

  // 临时关闭阴影，使圆点边框清晰
  ctx.shadowBlur = 0;

  // 绘制圆点：白色填充 + 薄黑边框
  ctx.beginPath();
  ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
  ctx.fillStyle = 'white';
  ctx.fill();
  ctx.strokeStyle = '#000000';      // 黑色边框
  ctx.lineWidth = 1;                // 很薄的边框
  ctx.stroke();

  // 恢复阴影设置
  ctx.shadowBlur = 4;

  // 绘制时间标签（类似 ReferenceLine 的 label）
  ctx.font = '12px system-ui, -apple-system, sans-serif';
ctx.fillStyle = '#6b7280';      // 改为灰色
ctx.shadowBlur = 0;
ctx.textAlign = 'center';
ctx.fillText(point.time, point.x, margin.top - 6);
ctx.shadowBlur = 4; // 恢复
}

    // 可选：在图表区域绘制一个非常淡的渐变遮罩，增强视觉（非必要，但可帮助淡化效果）
    if (splitX < width) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.04; // 极淡的渐变，不影响线条可见度，但让右侧整体感觉更柔和
      const grad = ctx.createLinearGradient(splitX, 0, width, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(1, 'rgba(255,255,255,0.1)');
      ctx.fillStyle = grad;
      ctx.fillRect(splitX, 0, width - splitX, height);
      ctx.restore();
    }
  }, [chartData, dimensions, lineColor, maskLeftPercent, activePoint, margin]);

  // 监听容器尺寸变化
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // 数据或尺寸变化时重绘
  useEffect(() => {
    drawChart();
  }, [drawChart]);

  // 窗口 resize 辅助
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ---------- 交互 ----------
  const handleInteraction = (clientX: number) => {
    if (!containerRef.current || chartData.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    let relativeX = (clientX - rect.left) / rect.width;
    relativeX = Math.min(Math.max(relativeX, 0), 1);
    setMaskLeftPercent(relativeX * 100);

    const index = Math.min(chartData.length - 1, Math.max(0, Math.floor(relativeX * chartData.length)));
    const point = chartData[index];
    setActivePoint({ time: point.time, value: point.value, index });
    onHoverValueChange(point.value, point.time);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => handleInteraction(e.clientX);
  const handleMouseLeave = () => {
    setActivePoint(null);
    setMaskLeftPercent(null);
    onHoverValueChange(null);
  };
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (touch) handleInteraction(touch.clientX);
  };
  const handleTouchEnd = () => {
    setActivePoint(null);
    setMaskLeftPercent(null);
    onHoverValueChange(null);
  };

  // ---------- 生命周期 ----------
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
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [period, currency, totalValue]);

  const periodLabels: Record<Period, string> = {
    '1W': '1周',
    '1M': '1月',
    '6M': '6月',
  };

  return (
    <div className="w-full relative">
      <div
        ref={containerRef}
        className="h-64 w-full relative cursor-crosshair"
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