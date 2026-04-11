// components/ProfitCalendar.tsx
"use client";

import React from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DailyReturn {
  date: string;       // YYYY-MM-DD
  value: number;      // 当日收益（用户当前货币）
}

interface ProfitCalendarProps {
  dailyReturns: DailyReturn[];
  currentMonth: Date;
  onMonthChange: (delta: number) => void;
  formatMoney: (num: number) => string;
}

export default function ProfitCalendar({
  dailyReturns,
  currentMonth,
  onMonthChange,
  formatMoney,
}: ProfitCalendarProps) {
  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startWeekday = firstDay.getDay(); // 0 = 周日

    const days: { date: string; profit: number | null }[] = [];
    for (let i = 0; i < startWeekday; i++) {
      days.push({ date: '', profit: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const profit = dailyReturns.find(r => r.date === dateStr)?.value ?? null;
      days.push({ date: dateStr, profit });
    }
    return days;
  };

  const getSign = (value: number) => (value > 0 ? '+' : value < 0 ? '-' : '');

  return (
    <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 shadow-md mb-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={20} className="text-gray-500 dark:text-gray-400" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">收益日历</h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onMonthChange(-1)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-medium">
            {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月
          </span>
          <button
            onClick={() => onMonthChange(1)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 dark:text-gray-400 mb-2">
        {['日', '一', '二', '三', '四', '五', '六'].map(day => <div key={day}>{day}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {getCalendarDays().map((day, idx) => {
          const profit = day.profit;
          const isPositive = profit !== null && profit > 0;
          const isNegative = profit !== null && profit < 0;
          return (
            <div
              key={idx}
              className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs ${
                profit === null
                  ? 'text-gray-300 dark:text-gray-600'
                  : isPositive
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                  : isNegative
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              }`}
            >
              <span className="font-bold">{day.date ? day.date.split('-')[2] : ''}</span>
              {profit !== null && (
                <span className="text-[10px]">
                  {getSign(profit)}{formatMoney(Math.abs(profit))}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center">
        每日收益 = 今日0点净值 - 昨日0点净值
      </p >
    </div>
  );
}