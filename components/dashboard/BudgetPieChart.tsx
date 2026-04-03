// components/dashboard/BudgetPieChart.tsx
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useTheme } from '@/app/ThemeProvider';
import { eventBus } from '@/src/utils/eventBus';

interface BudgetPieChartProps {
  budget: number;
  spent: number;
  currencySymbol: string;
}

export default function BudgetPieChart({ budget, spent, currencySymbol }: BudgetPieChartProps) {
  const { theme } = useTheme();
  const [isAmountHidden, setIsAmountHidden] = useState(false);
  const [outerRadius, setOuterRadius] = useState(45);
  const [isMobile, setIsMobile] = useState(false);
  const resizeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const unsubscribe = eventBus.subscribe('toggleAmountVisibility', (hidden: boolean) => {
      setIsAmountHidden(hidden);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        const mobile = window.innerWidth < 768;
        setIsMobile(mobile); 
        setOuterRadius(mobile ? 30 : 35);
      }, 150);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    };
  }, []);

  const currentMonth = new Date().toLocaleString('default', { month: '2-digit' }) + '月';
  const remaining = Math.max(budget - spent, 0);
  const isOverBudget = spent > budget;
  let remainingPercent: number;
  let spentPercentForChart: number;
  let remainingPercentForChart: number;

  if (budget === 0) {
    remainingPercent = 0;
    spentPercentForChart = 0;
    remainingPercentForChart = 1;
  } else if (isOverBudget) {
    remainingPercent = ((budget - spent) / budget) * 100;
    spentPercentForChart = 1;
    remainingPercentForChart = 0;
  } else {
    remainingPercent = (remaining / budget) * 100;
    spentPercentForChart = spent / budget;
    remainingPercentForChart = 1 - spentPercentForChart;
  }

  const pieData = [
    { name: '支出', value: spentPercentForChart, color: '#f97316' },
    { name: '剩余', value: remainingPercentForChart, color: theme === 'dark' ? '#374151' : '#e5e7eb' },
  ].filter(item => item.value > 0);

  const formatLargeNumber = (num: number): string => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  if (budget === undefined || budget === null) {
    return (
      <div className="px-2 mb-2">
        <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-4 text-center text-gray-400 dark:text-gray-500">
          暂无预算数据
        </div>
      </div>
    );
  }

  const chartSize = outerRadius * 2 + 10;

  return (
    <div className="px-2 mb-2">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-[12px] font-normal text-gray-800 dark:text-gray-100">本月总预算</h3>
      </div>

      <div className="flex flex-row items-center gap-3 justify-start flex-nowrap">
        {/* 饼图 */}
        <div className="flex-shrink-0">
          <div style={{ width: chartSize, height: chartSize }} className="relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={outerRadius * 0.65}
                  outerRadius={outerRadius}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center text-center">
              {!isAmountHidden && (
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                  {remainingPercent.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 右侧区域：flex-1 占满剩余宽度，内部 justify-between 实现两端对齐 */}
        <div className="flex-1 flex flex-row justify-between items-baseline">
          <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">剩余预算：</span>
          {isAmountHidden ? (
            <span className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-widest">****</span>
          ) : (
            <span className="text-base font-bold text-gray-700 dark:text-gray-100 whitespace-nowrap">
              {currencySymbol}{formatLargeNumber(remaining)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}