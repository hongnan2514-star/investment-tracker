// components/dashboard/AssetPieChart.tsx
"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Asset } from '@/src/constants/types';
import { eventBus } from '@/src/utils/eventBus';
import { useTheme } from '@/app/ThemeProvider';
import { useCurrency, useCurrencyConverter } from '@/src/services/currency';

const ASSET_TYPE_CONFIG: Record<string, { name: string }> = {
  stock: { name: '股票' },
  fund: { name: '基金' },
  crypto: { name: '加密货币' },
  metal: { name: '贵金属' },
  car: { name: '车辆' },
  real_estate: { name: '不动产' },
  custom: { name: '现金' },
  receivable: { name: '应收款' },
  liability: { name: '负债' },
  custom_asset: { name: '自定义' }
};

const getColorForType = (type: string): string => {
  let hash = 0;
  for (let i = 0; i < type.length; i++) {
    hash = ((hash << 5) - hash) + type.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 60%)`;
};

interface AssetPieChartProps {
  assets: Asset[];
}

export default function AssetPieChart({ assets }: AssetPieChartProps) {
  const { theme } = useTheme();
  const { currency, symbol } = useCurrency();
  const { convert } = useCurrencyConverter();

  const [pieData, setPieData] = useState<{ type: string; name: string; value: number; percent: string; color: string }[]>([]);
  const [totalConverted, setTotalConverted] = useState<number>(0);
  const [isAmountHidden, setIsAmountHidden] = useState(false);
  const [outerRadius, setOuterRadius] = useState(100);
  const [isMobile, setIsMobile] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const resizeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleResize = () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        const mobile = window.innerWidth < 768;
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

  // 更新饼图数据
  const updatePieData = useCallback(async () => {
    const validAssets = assets.filter(asset =>
      asset.marketValue != null && Number.isFinite(asset.marketValue) && asset.marketValue > 0
    );
    if (validAssets.length === 0) {
      setPieData([]);
      setTotalConverted(0);
      return;
    }

    setIsConverting(true);
    try {
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
            color: getColorForType(type),
          };
        })
        .sort((a, b) => b.value - a.value);
      setPieData(newData);
    } finally {
      setIsConverting(false);
    }
  }, [assets, currency, convert]);

  useEffect(() => {
    updatePieData();
  }, [updatePieData]);

  if (assets.length === 0 || pieData.length === 0) {
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