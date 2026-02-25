"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { getAssets } from '@/src/utils/assetStorage';
import { Asset } from '@/src/constants/types';
import { eventBus } from '@/src/utils/eventBus';
import { useTheme } from '@/app/ThemeProvider';

// 资产类型显示名称和颜色映射（已补全）
const ASSET_TYPE_CONFIG: Record<string, { name: string; color: string }> = {
  stock: {
    name: '股票',
    color: '#1e67f7' // 蓝色
  },
  fund: {
    name: '基金',
    color: '#10b981' // 绿色
  },
  etf: {
    name: 'ETF',
    color: '#8b5cf6' // 紫色
  },
  crypto: {
    name: '加密货币',
    color: '#ec4899' // 橙色
  },
  metal: {
    name: '贵金属',
    color: '#f59e0b' // 粉色
  },
  car: {
    name: '车辆',
    color: '#06b6d4' // 青色
  },
  real_estate: {
    name: '房产',
    color: '#f97316' // 橙色（稍深）
  },
  custom: {
    name: '自定义',
    color: '#6b7280' // 灰色
  }
};

// 为未知类型生成颜色的后备函数
const getColorForUnknownType = (type: string): string => {
  const fallbackColors = ['#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#f97316'];
  let hash = 0;
  for (let i = 0; i < type.length; i++) {
    hash = ((hash << 5) - hash) + type.charCodeAt(i);
    hash |= 0;
  }
  return fallbackColors[Math.abs(hash) % fallbackColors.length];
};

export default function AssetPieChart() {
  const { theme } = useTheme();
  const [pieData, setPieData] = useState<{ 
    type: string;
    name: string; 
    value: number; 
    percent: string;
    color: string;
  }[]>([]);
  const [totalValue, setTotalValue] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('USD');
  const [innerRadius] = useState(0); // 实心饼图
  const [outerRadius, setOuterRadius] = useState(100); // 桌面端尺寸
  const [isMobile, setIsMobile] = useState(false); // 移动端标志
  const resizeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 响应式半径（带防抖）
  useEffect(() => {
    const handleResize = () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        const width = window.innerWidth;
        const mobile = width < 768;
        setIsMobile(mobile);
        setOuterRadius(mobile ? 75 : 100);
      }, 150); // 150ms防抖
    };
    handleResize(); // 初始化
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    };
  }, []);

  // 更新图表数据（带浅比较，避免重复渲染）
  const updateChartData = useCallback((assets: Asset[]) => {
    if (assets.length === 0) {
      setPieData([]);
      setTotalValue(0);
      return;
    }

    // 过滤掉 marketValue 无效或 <=0 的资产
    const validAssets = assets.filter(asset => 
      asset.marketValue != null && 
      Number.isFinite(asset.marketValue) && 
      asset.marketValue > 0
    );

    if (validAssets.length === 0) {
      setPieData([]);
      setTotalValue(0);
      return;
    }

    const total = validAssets.reduce((sum, asset) => sum + asset.marketValue, 0);
    setTotalValue(total);
    setCurrency(validAssets[0].currency || 'USD');

    const typeGroups = validAssets.reduce((groups, asset) => {
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

    // 浅比较，只有数据变化时才更新
    setPieData(prev => {
      if (prev.length !== newData.length) return newData;
      for (let i = 0; i < prev.length; i++) {
        if (prev[i].value !== newData[i].value) return newData;
      }
      return prev;
    });
  }, []);

  // 初始加载和事件订阅
  useEffect(() => {
    updateChartData(getAssets() as Asset[]);
    const unsubscribeAssetsUpdated = eventBus.subscribe('assetsUpdated', () => {
      updateChartData(getAssets() as Asset[]);
    });
    const unsubscribeUserChanged = eventBus.subscribe('userChanged', () => {
      updateChartData(getAssets() as Asset[]);
    });
    return () => {
      unsubscribeAssetsUpdated();
      unsubscribeUserChanged();
    };
  }, [updateChartData]);

  const getCurrencySymbol = () => {
    const currencySymbolMap: Record<string, string> = {
      USD: '$',
      CNY: '¥',
    };
    return currencySymbolMap[currency] || currency;
  };

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
          总市值: <span className="font-bold text-gray-900 dark:text-gray-100">
            {getCurrencySymbol()}{totalValue.toFixed(2)}
          </span>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
        {/* 饼图区域 */}
        <div className="w-full md:w-1/2 h-72 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 40, right: 40, bottom: 40, left: 40 }}>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                paddingAngle={2}
                dataKey="value"
                labelLine={false}
                label={({ name, percent, payload, cx, cy, outerRadius, startAngle, endAngle }) => {
                  if (percent == null || percent < 0.03) return null;

                  const RADIAN = Math.PI / 180;
                  const midAngle = (startAngle + endAngle) / 2;
                  const radius = outerRadius + (isMobile ? 20 : 45);
                  const x = cx + radius * Math.cos(midAngle * RADIAN);
                  const y = cy + radius * Math.sin(midAngle * RADIAN);
                  
                  let textAnchor: 'start' | 'middle' | 'end' = 'middle';
                  if (midAngle > 270 || midAngle < 90) {
                    textAnchor = 'start';
                  } else if (midAngle > 90 && midAngle < 270) {
                    textAnchor = 'end';
                  }
                  
                  const labelColor = theme === 'dark' ? '#e5e7eb' : '#1f2937';
                  const fontSize = isMobile ? 10 : 12;
                  const displayPercent = payload.percent; 
                  
                  return (
                    <text
                      x={x}
                      y={y}
                      fill={labelColor}
                      textAnchor={textAnchor}
                      dominantBaseline="middle"
                      fontSize={fontSize}
                      fontWeight="600"
                    >
                      {`${name} ${displayPercent}`}
                    </text>
                  );
                }}
              >
                {pieData.map((entry) => (
                  <Cell
                    key={entry.type}
                    fill={entry.color}
                    stroke={theme === 'dark' ? '#1f2937' : 'white'}
                    strokeWidth={2}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 图例区域 */}
        <div className="w-full md:w-1/2 space-y-4">
          {pieData.map((entry) => (
            <div key={entry.type} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {entry.name}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[60px] text-right">
                  {entry.percent}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[80px] text-right">
                  {getCurrencySymbol()}{entry.value.toFixed(0)}
                </span>
              </div>
            </div>
          ))}
          
          <div className="pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">合计</span>
              <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                {getCurrencySymbol()}{totalValue.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}