// app/portfolio/charts/FundChart.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../../ThemeProvider' // 根据项目实际路径调整

export type FundChartRange = '1M' | '6M' | '1Y' | 'since_holding';

interface FundChartProps {
  symbol: string;
  changePercent: number | null;
  purchaseDate?: string;
  costPrice?: number;
  currentPrice?: number; // 新增当前价格，用于计算盈亏
}

export default function FundChart({ 
  symbol, 
  changePercent, 
  purchaseDate, 
  costPrice,
  currentPrice 
}: FundChartProps) {
  const [range, setRange] = useState<FundChartRange>('1M');
  const [data, setData] = useState<{ date: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { theme } = useTheme(); // 获取当前主题

  // 计算盈亏百分比（相对于成本价）
  let profitPercent = 0;
  if (costPrice && costPrice > 0 && currentPrice) {
    profitPercent = ((currentPrice - costPrice) / costPrice) * 100;
  }

  // 根据盈亏和主题确定线条颜色
  let strokeColor: string;
  if (profitPercent > 0) {
    strokeColor = '#22c55e'; // 盈利：绿色
  } else if (profitPercent < 0) {
    strokeColor = '#ef4444'; // 亏损：红色
  } else {
    // 持平：根据主题
    strokeColor = theme === 'dark' ? '#ffffff' : '#000000';
  }

  const getRequestParams = (range: FundChartRange): { apiRange: string; limit: number; isSinceHolding: boolean } => {
    switch (range) {
      case '1M':
        return { apiRange: '1d', limit: 30, isSinceHolding: false };
      case '6M':
        return { apiRange: '1d', limit: 180, isSinceHolding: false };
      case '1Y':
        return { apiRange: '1d', limit: 365, isSinceHolding: false };
      case 'since_holding':
        return { apiRange: 'since_holding', limit: 0, isSinceHolding: true };
      default:
        return { apiRange: '1d', limit: 30, isSinceHolding: false };
    }
  };

  // 将任意日期格式转换为 YYYY-MM-DD
  const normalizeDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return dateStr;
  };

  const filterDataByRange = (data: { date: string; value: number }[], range: FundChartRange): { date: string; value: number }[] => {
    if (range === 'since_holding') return data;

    const now = new Date();
    let cutoffDate: Date;

    switch (range) {
      case '1M':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '6M':
        cutoffDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '1Y':
        cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        return data;
    }
    cutoffDate.setHours(0, 0, 0, 0);

    const cutoffTimestamp = cutoffDate.getTime();
    console.log(`[FundChart] 过滤前 ${data.length} 条, range=${range}, cutoffDate=${cutoffDate.toISOString()}`);

    const filtered = data.filter(item => {
      const itemTimestamp = new Date(item.date).getTime();
      return itemTimestamp >= cutoffTimestamp;
    });

    console.log(`[FundChart] 过滤后 ${filtered.length} 条`);
    return filtered;
  };

  useEffect(() => {
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
          url = `/api/history?symbol=${encodeURIComponent(symbol)}&type=fund&range=since_holding&startDate=${purchaseDate}`;
        } else {
          url = `/api/history?symbol=${encodeURIComponent(symbol)}&type=fund&range=${apiRange}&limit=${limit}`;
        }

        const res = await fetch(url, { signal: controller.signal });
        const json = await res.json();

        if (isCurrent && json.success && json.data?.length > 0) {
          // 1. 映射数据，并规范化日期
          let newData = json.data.map((item: any) => ({ 
            date: normalizeDate(item.date), 
            value: item.value 
          }));

          console.log('[FundChart] 原始数据（规范化后）:', newData);

          // 2. 如果是持有以来且有成本价，在第一个点插入成本价
          if (isSinceHolding && costPrice !== undefined && purchaseDate) {
            const normalizedPurchaseDate = normalizeDate(purchaseDate);
            const firstDate = newData.length > 0 ? newData[0].date : null;
            if (firstDate === normalizedPurchaseDate) {
              newData[0] = { date: normalizedPurchaseDate, value: costPrice };
            } else {
              newData = [{ date: normalizedPurchaseDate, value: costPrice }, ...newData];
            }
            console.log('[FundChart] 插入成本价后:', newData);
          }

          // 3. 根据 range 过滤
          const filteredData = filterDataByRange(newData, range);
          console.log('[FundChart] 过滤后数据:', filteredData);

          // 4. 确保数据按日期升序
          filteredData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          console.log('[FundChart] 排序后数据:', filteredData);

          let displayData = filteredData;

          // 5. 如果只有一条数据，构造第二个点以绘制水平线（适用于所有range）
          if (filteredData.length === 1) {
            const single = filteredData[0];
            const nextDate = new Date(single.date);
            nextDate.setDate(nextDate.getDate() + 1);
            displayData = [
              single,
              { date: nextDate.toISOString().split('T')[0], value: single.value }
            ];
            console.log('[FundChart] 仅有一条数据，构造辅助点:', displayData);
          }

          setData(displayData);
        } else if (isCurrent) {
          setData([]);
        }
      } catch (error) {
        if (isCurrent && error instanceof Error && error.name !== 'AbortError') {
          console.error('获取基金历史数据失败', error);
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
      <div className="flex justify-between px-2 mb-2">
        {(['1M', '6M', '1Y', 'since_holding'] as FundChartRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              range === r
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {r === '1M' ? '1月' : r === '6M' ? '6月' : r === '1Y' ? '1年' : '持有以来'}
          </button>
        ))}
      </div>

      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.map(item => ({ value: item.value }))}>
            <YAxis domain={['auto', 'auto']} hide={true} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={strokeColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}