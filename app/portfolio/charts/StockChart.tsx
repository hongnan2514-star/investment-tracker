// app/portfolio/charts/StockChart.tsx
"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LineChart, Line, ReferenceDot, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Loader2 } from 'lucide-react';
import { eventBus } from '@/src/utils/eventBus';
import { getCurrentUserId } from '@/src/utils/assetStorage';

export type ChartRange = '1d' | '1M' | 'since_holding';

interface Transaction {
  id: number;
  user_id: string;
  asset_symbol: string;
  transaction_type: 'buy' | 'sell';
  quantity: number;
  price: number;
  transaction_date: string;
  currency: string;
  created_at: string;
}

interface StockChartProps {
  symbol: string;
  changePercent: number | null;
  purchaseDate?: string;
  costPrice?: number;
}

export default function StockChart({
  symbol,
  changePercent,
  purchaseDate,
  costPrice
}: StockChartProps) {
  const [range, setRange] = useState<ChartRange>('1d');
  const [data, setData] = useState<{ date: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 获取交易记录
  const fetchTransactions = async () => {
    try {
      const userId = getCurrentUserId();
      if (!userId) return;
      const res = await fetch(`/api/transaction?assetSymbol=${encodeURIComponent(symbol)}`, {
        headers: { 'x-user-id': userId },
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (err) {
      console.error('获取交易记录失败', err);
    }
  };

  // 监听资产更新事件，重新获取交易记录
  useEffect(() => {
    const unsubscribe = eventBus.subscribe('assetsUpdated', () => {
      fetchTransactions();
    });
    return unsubscribe;
  }, [symbol]);

  // 获取历史数据
  const getRequestParams = (range: ChartRange): { apiRange: string; limit: number; isSinceHolding: boolean } => {
    const isHKStock = symbol.includes('.HK') || (/^\d{4,5}$/.test(symbol) && !/^\d{6}$/.test(symbol));
    const isAStock = symbol.includes('.SS') || symbol.includes('.SZ');
    switch (range) {
      case '1d':
        return { apiRange: '1h', limit: 168, isSinceHolding: false };
      case '1M':
        if (isHKStock) {
          return { apiRange: '1d_hk', limit: 30, isSinceHolding: false };
        } else if (isAStock) {
          return { apiRange: '1d_a', limit: 30, isSinceHolding: false };
        } else {
          return { apiRange: '4h', limit: 180, isSinceHolding: false };
        }
      case 'since_holding':
        return { apiRange: 'since_holding', limit: 0, isSinceHolding: true };
      default:
        return { apiRange: '1h', limit: 168, isSinceHolding: false };
    }
  };

  const filterDataByRange = (data: { date: string; value: number }[], range: ChartRange): { date: string; value: number }[] => {
    if (range === 'since_holding') return data;

    const now = new Date();
    let cutoffDate: Date;

    if (range === '1d') {
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      cutoffDate.setHours(0, 0, 0, 0);
    } else if (range === '1M') {
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      cutoffDate.setHours(0, 0, 0, 0);
    } else {
      return data;
    }

    const cutoffTimestamp = cutoffDate.getTime();
    const filtered = data.filter(item => new Date(item.date).getTime() >= cutoffTimestamp);
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
          url = `/api/history?symbol=${encodeURIComponent(symbol)}&type=stock&range=since_holding&startDate=${purchaseDate}`;
        } else {
          url = `/api/history?symbol=${encodeURIComponent(symbol)}&type=stock&range=${apiRange}&limit=${limit}`;
        }

        const res = await fetch(url, { signal: controller.signal });
        const json = await res.json();

        if (isCurrent && json.success && json.data?.length > 0) {
          let newData = json.data.map((item: any) => ({
            date: item.date,
            value: item.value
          }));

          if (isSinceHolding && costPrice !== undefined && purchaseDate) {
            const firstDate = newData.length > 0 ? newData[0].date : null;
            if (firstDate === purchaseDate) {
              newData[0] = { date: purchaseDate, value: costPrice };
            } else {
              newData = [{ date: purchaseDate, value: costPrice }, ...newData];
            }
          }

          const filteredData = filterDataByRange(newData, range);
          setData(filteredData);
        } else if (isCurrent) {
          setData([]);
        }
      } catch (error) {
        if (isCurrent && error instanceof Error && error.name !== 'AbortError') {
          console.error('获取股票历史数据失败', error);
        }
      } finally {
        if (isCurrent) {
          setLoading(false);
        }
      }
    };

    fetchData();
    fetchTransactions();

    return () => {
      controller.abort();
      isCurrent = false;
    };
  }, [symbol, range, purchaseDate, costPrice]);

  // 数据范围用于判断标注方向
  const dataMin = useMemo(() => data.length ? Math.min(...data.map(d => d.value)) : 0, [data]);
  const dataMax = useMemo(() => data.length ? Math.max(...data.map(d => d.value)) : 0, [data]);
  const dataMid = (dataMin + dataMax) / 2;

  // 构建标注点：按日期聚合，若同一天既有买又有卖则标记为'T'，否则为'B'或'S'
  const markers = useMemo(() => {
    if (!data.length || !transactions.length) return [];

    // 按日期聚合交易记录
    const byDate = new Map<string, { buy: number; sell: number }>();
    transactions.forEach(t => {
      const date = t.transaction_date;
      if (!byDate.has(date)) byDate.set(date, { buy: 0, sell: 0 });
      const entry = byDate.get(date)!;
      if (t.transaction_type === 'buy') entry.buy++;
      else entry.sell++;
    });

    // 为每个数据点创建标记
    const markersList: { date: string; value: number; label: string; yOffset: number }[] = [];
    data.forEach(point => {
      const date = point.date;
      const trans = byDate.get(date);
      if (!trans) return;

      let label = '';
      if (trans.buy > 0 && trans.sell > 0) label = 'T';
      else if (trans.buy > 0) label = 'B';
      else if (trans.sell > 0) label = 'S';
      if (!label) return;

      // 决定偏移方向：价格高于中位数则向下偏移（避免遮挡），否则向上偏移
      const isAboveMid = point.value > dataMid;
      const yOffset = isAboveMid ? 20 : -20;   // 向上为负，向下为正

      markersList.push({
        date: point.date,
        value: point.value,
        label,
        yOffset,
      });
    });
    return markersList;
  }, [data, transactions, dataMid]);

  const strokeColor = changePercent != null
    ? changePercent >= 0 ? '#22c55e' : '#ef4444'
    : '#6b7280';

  return (
    <div className="flex flex-col h-full">
      {/* 时间范围按钮 */}
      <div className="flex justify-between px-2 mb-2">
        {(['1d', '1M', 'since_holding'] as ChartRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              range === r
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {r === '1d' ? '1周' : r === '1M' ? '1月' : '持有以来'}
          </button>
        ))}
      </div>

      {/* 图表区域 */}
      <div className="flex-1 w-full min-h-0">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
        ) : data.length < 2 ? (
          <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
            暂无走势数据
          </div>
        ) : (
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
              <XAxis dataKey="date" hide={true} />
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
              {markers.map((marker, idx) => {
                const bgColor = marker.label === 'B' ? '#22c55e' : marker.label === 'S' ? '#ef4444' : '#f59e0b';
                return (
                  <ReferenceDot
                    key={idx}
                    x={marker.date}
                    y={marker.value}
                    shape={(props: any) => {
                      const { cx, cy } = props;
                      const yOffset = marker.yOffset;
                      const centerX = cx;
                      const centerY = cy + yOffset;
                      const arrowSize = 8;
                      const rectWidth = 10;
                      const rectHeight = 10;
                      const isAbove = yOffset < 0; // 标注在上方，箭头朝下
                      const rectX = centerX - rectWidth / 2;
                      const rectY = centerY - rectHeight / 2;
                      // 三角形路径
                      let trianglePoints = '';
                      if (isAbove) {
                        // 箭头朝下，位于矩形下方
                        const tipX = centerX;
                        const tipY = centerY + rectHeight/2 + arrowSize;
                        const leftX = tipX - arrowSize/2;
                        const rightX = tipX + arrowSize/2;
                        trianglePoints = `${tipX},${tipY} ${leftX},${tipY-arrowSize} ${rightX},${tipY-arrowSize}`;
                      } else {
                        // 箭头朝上，位于矩形上方
                        const tipX = centerX;
                        const tipY = centerY - rectHeight/2 - arrowSize;
                        const leftX = tipX - arrowSize/2;
                        const rightX = tipX + arrowSize/2;
                        trianglePoints = `${tipX},${tipY} ${leftX},${tipY+arrowSize} ${rightX},${tipY+arrowSize}`;
                      }
                      return (
                        <g>
                          <rect x={rectX} y={rectY} width={rectWidth} height={rectHeight} fill={bgColor} stroke="white" strokeWidth={1} rx={2} />
                          <polygon points={trianglePoints} fill={bgColor} stroke="white" strokeWidth={0} />
                          <text x={centerX} y={centerY} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={8} fontWeight="bold">
                            {marker.label}
                          </text>
                        </g>
                      );
                    }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}