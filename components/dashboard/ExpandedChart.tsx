// components/dashboard/ExpandedChart.tsx
"use client";
import React, { useState, useEffect } from 'react';
import { LineChart, Line, Tooltip, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Loader2, ChevronUp } from 'lucide-react';
import { getAssets } from '@/src/utils/assetStorage';
import { getHistoryData } from '@/src/services/historyService';

type Period = '1D' | '1W' | '1M' | '6M';

interface Props {
  totalValue: number;
  currencySymbol: string;
  todayProfit: number;
  onClose: () => void; // 新增关闭函数
}

export default function ExpandedChart({ totalValue, currencySymbol, todayProfit, onClose }: Props) {
  const [period, setPeriod] = useState<Period>('1D');
  const [chartData, setChartData] = useState<{ time: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lineColor = todayProfit >= 0 ? '#22c55e' : '#ef4444';

  const fetchPortfolioHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const assets = getAssets();
      console.log('前端资产数量:', assets.length);

      const res = await fetch('/api/history/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets, period }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      let rawData: { timestamp: number; value: number }[] = json.data || [];

      if (rawData.length === 0) {
        console.log('API无数据，使用本地快照作为后备');
        const hours = period === '1D' ? 24 : period === '1W' ? 168 : 720;
        const snapshot = getHistoryData(hours);
        rawData = snapshot.map(p => ({
          timestamp: p.timestamp,
          value: p.value,
        }));
      }

      // 格式化时间：1D显示 HH:mm，其他显示 MM-DD
      const formatted = rawData.map(p => ({
        time: period === '1D'
          ? new Date(p.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
          : new Date(p.timestamp).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
        value: p.value,
      }));
      setChartData(formatted);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioHistory();
  }, [period]);

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

  // 中文周期标签
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
                  return [`${currencySymbol}${numValue.toFixed(2)}`, '总资产'];
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

      {/* 周期按钮行 - 增加间距 */}
      <div className="flex justify-center gap-6 mt-4">
        {(['1D', '1W', '1M', '6M'] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 text-sm font-bold transition rounded-full ${
              period === p
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                : 'bg-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {periodLabels[p]}
          </button>
        ))}
      </div>

      {/* 朝上的箭头按钮（位于1周和1月之间下方） */}
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