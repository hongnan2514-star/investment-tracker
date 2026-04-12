// components/ProfitOverview.tsx
"use client";

import React from 'react';
import { useCurrency } from '@/src/services/currency';

interface ProfitOverviewProps {
  yesterdayProfit: number;
  weekProfit: number;
  weekReturnRate: number;
  currencySymbol: string;
}

export default function ProfitOverview({
  yesterdayProfit,
  weekProfit,
  weekReturnRate,
  currencySymbol,
}: ProfitOverviewProps) {
  const { currency } = useCurrency();

  const formatMoney = (num: number) => {
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPercent = (num: number) => {
    return num.toFixed(2);
  };

  const getValueColorClass = (value: number) => {
    if (value > 0) return 'text-green-500';
    if (value < 0) return 'text-red-500';
    return 'text-gray-900 dark:text-gray-100';
  };

  const getSign = (value: number) => {
    if (value > 0) return '+';
    if (value < 0) return '-';
    return '';
  };

return (
    <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">收益总览</h2>
        <span className="text-sm text-gray-400 dark:text-gray-500">
          ({currency})
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">昨日收益</p >
          <p className={`text-xl font-black ${getValueColorClass(yesterdayProfit)}`}>
            {getSign(yesterdayProfit)}{currencySymbol}{formatMoney(Math.abs(yesterdayProfit))}
          </p >
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">本周收益</p >
          <p className={`text-xl font-black ${getValueColorClass(weekProfit)}`}>
            {getSign(weekProfit)}{currencySymbol}{formatMoney(Math.abs(weekProfit))}
          </p >
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">近7天收益率</p >
          <p className={`text-xl font-black ${getValueColorClass(weekReturnRate)}`}>
            {getSign(weekReturnRate)}{formatPercent(Math.abs(weekReturnRate))}%
          </p >
        </div>
      </div>
    </div>
  );
}