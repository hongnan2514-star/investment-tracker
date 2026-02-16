"use client";
import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { getAssets } from '@/src/utils/assetStorage';
import { Asset } from '@/src/constants/types';
import { eventBus } from '@/src/utils/eventBus';
import { useTheme } from '@/app/ThemeProvider';

// 资产类型显示名称和颜色映射
const ASSET_TYPE_CONFIG: Record<string, { name: string; color: string }> = {
  stock: {
    name: '股票',
    color: '#1e67f7' // 蓝色
  },
  fund: {
    name: '基金',
    color: '#10b981' // 绿色
  },
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
  const [innerRadius, setInnerRadius] = useState(0); // 实心饼图
  const [outerRadius, setOuterRadius] = useState(100); // 桌面端尺寸

  // 响应式半径
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setOuterRadius(width < 768 ? 75 : 100);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const updateChartData = (assets: Asset[]) => {
    if (assets.length === 0) {
      setPieData([]);
      setTotalValue(0);
      return;
    }

    setCurrency(assets[0].currency || 'USD');

    const total = assets.reduce((sum, asset) => sum + asset.marketValue, 0);
    setTotalValue(total);

    const typeGroups = assets.reduce((groups, asset) => {
      const type = asset.type || 'unknown';
      groups[type] = (groups[type] || 0) + asset.marketValue;
      return groups;
    }, {} as Record<string, number>);

    const formattedData = Object.entries(typeGroups)
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

    setPieData(formattedData);
  };

  useEffect(() => {
    const assets = getAssets() as Asset[];
    updateChartData(assets);
  }, []);

  useEffect(() => {
    const unsubscribe = eventBus.subscribe('assetsUpdated', () => {
      const assets = getAssets() as Asset[];
      updateChartData(assets);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = eventBus.subscribe('userChanged', () => {
      const assets = getAssets() as Asset[];
      updateChartData(assets);
    });
    return () => unsubscribe();
  }, []);

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
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent, cx, cy, outerRadius, startAngle, endAngle }) => {
                  const RADIAN = Math.PI / 180;
                  const angle = (startAngle + endAngle) / 2;
                  const isMobile = window.innerWidth < 768;
                  const radius = outerRadius + (isMobile ? 25 : 40);
                  const x = cx + radius * Math.cos(angle * RADIAN);
                  const y = cy + radius * Math.sin(angle * RADIAN);
                  
                  let textAnchor: 'start' | 'middle' | 'end' = 'middle';
                  if (angle > 270 || angle < 90) {
                   textAnchor = 'start';
                  } else if (angle > 90 && angle < 270) {
                    textAnchor = 'end';
                  }
                  
                  const labelColor = theme === 'dark' ? '#e5e7eb' : '#1f2937';
                  
                  return (
                    <text
                      x={x}
                      y={y}
                      fill={labelColor}
                      textAnchor={textAnchor}
                      dominantBaseline="middle"
                      fontSize={isMobile ? 12 : 14}
                      fontWeight="600"
                    >
                      {`${name} ${percent}`}
                    </text>
                  );
                }}
                labelLine={false}
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