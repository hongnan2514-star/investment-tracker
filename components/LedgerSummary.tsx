// components/LedgerSummary.tsx
"use client";

import React from 'react';
import { ChevronDown } from 'lucide-react';

interface LedgerSummaryProps {
  loading: boolean;
  currentYear: number;
  currentMonth: number;
  monthNames: string[];
  currencySymbol: string;
  netBalance: number;
  totalIncome: number;
  totalExpense: number;
  onMonthClick: () => void;
}

// 数值格式化函数：K/M/B/T
const formatLargeNumber = (num: number): string => {
  if (Math.abs(num) >= 1_000_000_000_000) return (num / 1_000_000_000_000).toFixed(2) + 'T';
  if (Math.abs(num) >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
  if (Math.abs(num) >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (Math.abs(num) >= 1_000) return (num / 1_000).toFixed(2) + 'K';
  return num.toFixed(2);
};

// 骨架屏（适配新布局：月结余在上，三行指标在下）
function SummarySkeleton() {
  return (
    <div className="flex items-center gap-3 mb-6 px-2 animate-pulse">
      {/* 年月选择器骨架 */}
      <div className="flex flex-col shrink-0">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12 mb-2" />
        <div className="flex items-center gap-0 mt-0.5">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full ml-1" />
        </div>
      </div>
      {/* 分隔线 */}
      <div className="w-px h-12 bg-gray-300 dark:bg-gray-700 self-center" />
      {/* 右侧数据骨架 */}
      <div className="flex-1">
        {/* 月结余骨架 */}
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12 mb-1" />
        <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3" />
        {/* 三行指标骨架 */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-8" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          </div>
          <div className="flex justify-between items-center">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-8" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          </div>
          <div className="flex justify-between items-center">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LedgerSummary({
  loading,
  currentYear,
  currentMonth,
  monthNames,
  currencySymbol,
  netBalance,
  totalIncome,
  totalExpense,
  onMonthClick,
}: LedgerSummaryProps) {
  if (loading) {
    return <SummarySkeleton />;
  }

  return (
    <div className="flex items-center gap-3 mb-6 px-2">
      {/* 左侧：年月选择器 */}
      <div onClick={onMonthClick} className="flex flex-col shrink-0 cursor-pointer">
        <span className="text-sm text-gray-500 dark:text-gray-400">{currentYear}年</span>
        <div className="flex items-center gap-0 mt-0.5">
          <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">{monthNames[currentMonth]}</span>
          <ChevronDown size={18} className="translate-x-1 text-gray-500 dark:text-gray-400 translate-y-2 -m-1" />
        </div>
      </div>

      {/* 分隔线 */}
      <div className="w-px h-12 bg-gray-300 dark:bg-gray-700 self-center" />

      {/* 右侧：数据区域 */}
      <div className="flex-1">
        {/* 月结余 */}
        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs">
          <span>月结余</span>
        </div>
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {currencySymbol}{formatLargeNumber(netBalance)}
        </p >

        {/* 三行指标：支出、收入、日均支出 */}
        <div className="space-y-1.5">
          {/* 支出 */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">支出</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {currencySymbol}{formatLargeNumber(totalExpense)}
            </span>
          </div>
          {/* 收入 */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">收入</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {currencySymbol}{formatLargeNumber(totalIncome)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}