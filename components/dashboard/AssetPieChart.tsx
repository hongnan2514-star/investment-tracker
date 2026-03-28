// components/dashboard/AssetPieChart.tsx
// components/dashboard/AssetPieChart.tsx
"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Asset } from '@/src/constants/types';
import { eventBus } from '@/src/utils/eventBus';
import { useTheme } from '@/app/ThemeProvider';
import { useCurrency, useCurrencyConverter, CurrencyCode } from '@/src/services/currency';
import { getCurrentUserId } from '@/src/utils/assetStorage';

// 资产类型显示名称和颜色映射
const ASSET_TYPE_CONFIG: Record<string, { name: string; color: string }> = {
  stock: { name: '股票', color: '#1e67f7' },
  fund: { name: '基金', color: '#320bcd' },
  crypto: { name: '数字货币', color: '#ec4899' },
  metal: { name: '贵金属', color: '#f59e0b' },
  car: { name: '车辆', color: '#06b6d4' },
  real_estate: { name: '不动产', color: '#f97316' },
  custom: { name: '现金', color: '#1db81f' },
  receivable: { name: '应收款', color: 'rgb(13, 16, 226)'},
  liability: { name: '负债', color: 'rgb(223, 11, 11)'},
  custom_asset: { name: '自定义', color: 'rgb(114, 116, 127)'}
};

const getColorForUnknownType = (type: string): string => {
  const fallbackColors = ['#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#f97316'];
  let hash = 0;
  for (let i = 0; i < type.length; i++) {
    hash = ((hash << 5) - hash) + type.charCodeAt(i);
    hash |= 0;
  }
  return fallbackColors[Math.abs(hash) % fallbackColors.length];
};

// 骨架屏组件
const SkeletonLine = ({ className = "w-24 h-6" }: { className?: string }) => (
  <div className={`relative overflow-hidden bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${className}`} />
);

// ---------- 缓存机制 ----------
// 按用户ID缓存资产数据，有效期15分钟
type CacheEntry = {
  assets: Asset[];
  timestamp: number;
};
const assetCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 15 * 60 * 1000; // 15分钟

export default function AssetPieChart() {
  const { theme } = useTheme();
  const { currency, symbol } = useCurrency();
  const { convert, loading: converting } = useCurrencyConverter();

  const [pieData, setPieData] = useState<{
    type: string;
    name: string;
    value: number;
    percent: string;
    color: string;
  }[]>([]);
  const [totalConverted, setTotalConverted] = useState<number>(0);
  const [isAmountHidden, setIsAmountHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rawAssets, setRawAssets] = useState<Asset[]>([]);

  const [outerRadius, setOuterRadius] = useState(100);
  const [isMobile, setIsMobile] = useState(false);
  const resizeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 不依赖 loadAssets/updatePieData 的副作用
  useEffect(() => {
    const handleResize = () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        const width = window.innerWidth;
        const mobile = width < 768;
        setIsMobile(mobile);
        setOuterRadius(mobile ? 75 : 100);
      }, 150);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = eventBus.subscribe('toggleAmountVisibility', (hidden: boolean) => {
      setIsAmountHidden(hidden);
    });
    return unsubscribe;
  }, []);

  // 更新饼图数据（转换货币、分组）
  const updatePieData = useCallback(async (assets: Asset[]) => {
    console.log('[PieChart] updatePieData 被调用，当前货币:', currency, '资产数量:', assets.length);
    if (assets.length === 0) {
      setPieData([]);
      setTotalConverted(0);
      return;
    }
    const validAssets = assets.filter(asset => 
      asset.marketValue != null && Number.isFinite(asset.marketValue) && asset.marketValue > 0
    );
    if (validAssets.length === 0) {
      setPieData([]);
      setTotalConverted(0);
      return;
    }
    const convertedAssets = await Promise.all(
      validAssets.map(async (asset) => {
        let fromCurrency = asset.currency || 'USD';
        if (fromCurrency === 'USDT') fromCurrency = 'USD';
        const convertedValue = await convert(asset.marketValue, fromCurrency as any, currency);
        return { ...asset, marketValue: convertedValue };
      })
    );
    const total = convertedAssets.reduce((sum, asset) => sum + asset.marketValue, 0);
    setTotalConverted(total);
    const typeGroups = convertedAssets.reduce((groups, asset) => {
      const type = asset.type || 'unknown';
      groups[type] = (groups[type] || 0) + asset.marketValue;
      return groups;
    }, {} as Record<string, number>);
    const newData = Object.entries(typeGroups)
      .map(([type, value]) => {
        const config = ASSET_TYPE_CONFIG[type];
        return {
          type,
          name: config?.name || type,
          value,
          percent: ((value / total) * 100).toFixed(1) + '%',
          color: config?.color || getColorForUnknownType(type),
        };
      })
      .sort((a, b) => b.value - a.value);
    setPieData(newData);
  }, [currency, convert]);

  // 加载资产（带缓存）
  const loadAssets = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId) {
      setPieData([]);
      setTotalConverted(0);
      setLoading(false);
      setRawAssets([]);
      return;
    }

    // 检查缓存是否有效
    const cached = assetCache.get(userId);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log('[PieChart] 使用缓存的资产数据，userId:', userId);
      setRawAssets(cached.assets);
      await updatePieData(cached.assets);
      setLoading(false);
      return;
    }

    // 缓存无效，重新请求
    setLoading(true);
    try {
      const res = await fetch('/api/asset', {
        headers: { 'x-user-id': userId },
      });
      if (!res.ok) throw new Error('加载资产失败');
      const data = await res.json();
      const normalizedData = data.map((asset: any) => ({
        ...asset,
        price: Number(asset.price),
        holdings: Number(asset.holdings),
        marketValue: Number(asset.marketValue),
        costPrice: asset.costPrice ? Number(asset.costPrice) : undefined,
        changePercent: asset.changePercent ? Number(asset.changePercent) : 0,
      }));
      console.log('[PieChart] 原始资产加载完成，前3条:', normalizedData.slice(0,3));
      // 存入缓存
      assetCache.set(userId, {
        assets: normalizedData,
        timestamp: Date.now(),
      });
      setRawAssets(normalizedData);
      await updatePieData(normalizedData);
    } catch (err) {
      console.error('加载资产失败', err);
      setPieData([]);
      setTotalConverted(0);
    } finally {
      setLoading(false);
    }
  }, [updatePieData]);

  // 货币切换时重新转换
  useEffect(() => {
    if (rawAssets.length > 0) {
      updatePieData(rawAssets);
    } else {
      loadAssets();
    }
  }, [currency, rawAssets, updatePieData, loadAssets]);

  // 监听 currencyChanged 事件
  useEffect(() => {
    const handleCurrencyChange = (newCurrency: CurrencyCode) => {
      if (rawAssets.length > 0) {
        updatePieData(rawAssets);
      } else {
        loadAssets();
      }
    };
    const unsubscribe = eventBus.subscribe('currencyChanged', handleCurrencyChange);
    return unsubscribe;
  }, [currency, rawAssets, updatePieData, loadAssets]);

  // 初始化加载 + 监听资产更新/用户切换
  useEffect(() => {
    loadAssets();
    const unsubscribeAssets = eventBus.subscribe('assetsUpdated', () => {
      // 资产更新时清除当前用户的缓存
      const userId = getCurrentUserId();
      if (userId) assetCache.delete(userId);
      loadAssets();
    });
    const unsubscribeUser = eventBus.subscribe('userChanged', () => {
      // 用户切换时清除所有缓存
      assetCache.clear();
      loadAssets();
    });
    return () => {
      unsubscribeAssets();
      unsubscribeUser();
    };
  }, [loadAssets]);

  // 骨架屏加载状态
  if (loading) {
    return (
      <div className="px-2 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">资产类型分布</h3>
          <SkeletonLine className="w-24 h-5" />
        </div>
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          <div className="w-full md:w-1/2 h-72 flex items-center justify-center">
            <div className="w-40 h-40 md:w-52 md:h-52 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
          <div className="w-full md:w-1/2 space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  <SkeletonLine className="w-16 h-4" />
                </div>
                <div className="flex items-center gap-4">
                  <SkeletonLine className="w-12 h-4" />
                  <SkeletonLine className="w-16 h-4" />
                </div>
              </div>
            ))}
            <div className="pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <SkeletonLine className="w-12 h-4" />
                <SkeletonLine className="w-20 h-5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (pieData.length === 0) {
    return (
      <div className="px-2 mb-6">
        <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 text-center text-gray-400 dark:text-gray-500">
          暂无资产数据
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 mb-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">资产类型分布</h3>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          总市值: 
          {converting && <span className="ml-1 text-blue-500 animate-pulse">汇率更新中...</span>}
          <span className="font-bold text-gray-900 dark:text-gray-100 ml-1">
            {isAmountHidden ? '****' : `${symbol}${totalConverted.toFixed(2)}`}
          </span>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
        <div className="w-full md:w-1/2 h-72 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 40, right: 40, bottom: 40, left: 40 }}>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={outerRadius * (isMobile ? 0.55 : 0.6)}
                outerRadius={outerRadius}
                paddingAngle={2}
                dataKey="value"
                labelLine={false}
                label={({ payload, cx, cy, outerRadius, startAngle, endAngle }) => {
                  const percentValue = payload.value / totalConverted;
                  if (percentValue < 0.03) return null;
                  const RADIAN = Math.PI / 180;
                  const midAngle = (startAngle + endAngle) / 2;
                  const radius = outerRadius + (isMobile ? 13 : 45);
                  const x = cx + radius * Math.cos(midAngle * RADIAN);
                  const y = cy + radius * Math.sin(midAngle * RADIAN);
                  let textAnchor: 'start' | 'middle' | 'end' = 'middle';
                  if (midAngle > 270 || midAngle < 90) textAnchor = 'start';
                  else if (midAngle > 90 && midAngle < 270) textAnchor = 'end';
                  const labelColor = theme === 'dark' ? '#e5e7eb' : '#1f2937';
                  const fontSize = isMobile ? 12 : 14;
                  const displayPercent = (percentValue * 100).toFixed(1) + '%';
                  return (
                    <text x={x} y={y} fill={labelColor} textAnchor={textAnchor} dominantBaseline="middle" fontSize={fontSize} fontWeight="600">
                      {`${payload.name} ${displayPercent}`}
                    </text>
                  );
                }}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.type} fill={entry.color} stroke={theme === 'dark' ? '#1f2937' : 'white'} strokeWidth={2} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="w-full md:w-1/2 space-y-4">
          {pieData.map((entry) => (
            <div key={entry.type} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{entry.name}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[60px] text-right">{entry.percent}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[80px] text-right">
                  {isAmountHidden ? '****' : `${symbol}${entry.value.toFixed(0)}`}
                </span>
              </div>
            </div>
          ))}
          <div className="pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">合计</span>
              <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                {isAmountHidden ? '****' : `${symbol}${totalConverted.toFixed(2)}`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}