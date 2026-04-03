// components/dashboard/BudgetPieChart.tsx
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useTheme } from '@/app/ThemeProvider';
import { eventBus } from '@/src/utils/eventBus';

interface BudgetPieChartProps {
  /** 本月预算总额（已转换为当前货币） */
  budget: number;
  /** 本月支出总额（已转换为当前货币） */
  spent: number;
  /** 当前货币符号 */
  currencySymbol: string;
}

const SkeletonLine = ({ className = "w-24 h-6" }: { className?: string }) => (
  <div className={`relative overflow-hidden bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${className}`} />
);

export default function BudgetPieChart({ budget, spent, currencySymbol }: BudgetPieChartProps) {
  const { theme } = useTheme();
  const [isAmountHidden, setIsAmountHidden] = useState(false);
  const [outerRadius, setOuterRadius] = useState(90);
  const [isMobile, setIsMobile] = useState(false);
  const resizeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 监听金额隐藏/显示事件
  useEffect(() => {
    const unsubscribe = eventBus.subscribe('toggleAmountVisibility', (hidden: boolean) => {
      setIsAmountHidden(hidden);
    });
    return unsubscribe;
  }, []);

  // 窗口大小适配
  useEffect(() => {
    const handleResize = () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        const mobile = window.innerWidth < 768;
        setIsMobile(mobile);
        setOuterRadius(mobile ? 70 : 90);
      }, 150);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    };
  }, []);

  // 获取当前月份（如 "04月"）
  const currentMonth = new Date().toLocaleString('default', { month: '2-digit' }) + '月';

  // 计算剩余预算和百分比
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
    remainingPercent = ((budget - spent) / budget) * 100; // 负数
    spentPercentForChart = 1;
    remainingPercentForChart = 0;
  } else {
    remainingPercent = (remaining / budget) * 100;
    spentPercentForChart = spent / budget;
    remainingPercentForChart = 1 - spentPercentForChart;
  }

  // 环形图数据
  const pieData = [
    { name: '支出', value: spentPercentForChart, color: '#f97316' }, // 橙色表示支出
    { name: '剩余', value: remainingPercentForChart, color: theme === 'dark' ? '#374151' : '#e5e7eb' },
  ].filter(item => item.value > 0);

  // 格式化大数字
  const formatLargeNumber = (num: number): string => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  // 如果预算为零或未定义，显示占位状态（非加载状态）
  if (budget === undefined || budget === null) {
    return (
      <div className="px-2 mb-6">
        <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 text-center text-gray-400 dark:text-gray-500">
          暂无预算数据
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 mb-6">
      {/* 标题区 */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{currentMonth}总预算</h3>
      </div>

      <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
        {/* 环形图区域 */}
        <div className="relative w-full md:w-1/2 flex justify-center">
          <div className="relative" style={{ width: isMobile ? 200 : 240, height: isMobile ? 200 : 240 }}>
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
            {/* 中心文字 */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              {isAmountHidden ? (
                <>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100 tracking-widest">****</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">剩余</span>
                </>
              ) : (
                <>
                  <span className="text-xl font-black text-gray-900 dark:text-gray-100">
                    {currencySymbol}{formatLargeNumber(remaining)}
                  </span>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">
                    剩余 {isOverBudget ? `${remainingPercent.toFixed(1)}%` : `${remainingPercent.toFixed(1)}%`}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 数据统计区 */}
        <div className="w-full md:w-1/2 space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">本月预算</span>
            <span className="text-base font-bold text-gray-900 dark:text-gray-100">
              {isAmountHidden ? '****' : `${currencySymbol}${formatLargeNumber(budget)}`}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">本月支出</span>
            <span className="text-base font-bold text-gray-900 dark:text-gray-100">
              {isAmountHidden ? '****' : `${currencySymbol}${formatLargeNumber(spent)}`}
            </span>
          </div>
          {isOverBudget && !isAmountHidden && (
            <div className="mt-2 text-xs text-red-500 dark:text-red-400 text-center font-medium">
              已超出预算 {currencySymbol}{formatLargeNumber(spent - budget)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}