// components/ProfitCalendar.tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DailyReturn {
  date: string;
  value: number;
}

interface ProfitCalendarProps {
  dailyReturns: DailyReturn[];
  currentMonth: Date;
  onMonthChange: (delta: number) => void;
  onSetMonth: (year: number, month: number) => void;
  formatMoney: (num: number) => string;
}

export default function ProfitCalendar({
  dailyReturns,
  currentMonth,
  onMonthChange,
  onSetMonth,
  formatMoney,
}: ProfitCalendarProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth() + 1;

  // 生成前后 50 年的年份列表（共 101 年）
  const years = Array.from({ length: 101 }, (_, i) => year - 50 + i);

  const handleSelectMonth = (selectedYear: number, selectedMonth: number) => {
    onSetMonth(selectedYear, selectedMonth - 1);
    setShowPicker(false);
  };

  const getCalendarDays = () => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startWeekday = firstDay.getDay();
    const todayStr = new Date().toISOString().split('T')[0];

    const days: { date: string; profit: number | null }[] = [];
    for (let i = 0; i < startWeekday; i++) {
      days.push({ date: '', profit: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      let profit = dailyReturns.find(r => r.date === dateStr)?.value ?? null;
      if (dateStr === todayStr) profit = null;
      days.push({ date: dateStr, profit });
    }
    return days;
  };

  const getSign = (value: number) => (value > 0 ? '+' : value < 0 ? '-' : '');

  return (
    <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 mb-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">收益日历</h3>
        </div>
        <div className="flex gap-2 relative">
          <button
            onClick={() => onMonthChange(-1)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="text-sm font-medium mt-0 px-2 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
          >
            {year}年 {month}月
          </button>
          <button
            onClick={() => onMonthChange(1)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
          >
            <ChevronRight size={20} />
          </button>

          {showPicker && (
            <div
              ref={pickerRef}
              className="absolute top-full right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-50 w-72"
            >
              <div className="mb-3">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">年份</label>
                <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-1 grid grid-cols-4 gap-1">
                  {years.map((y) => (
                    <button
                      key={y}
                      onClick={() => handleSelectMonth(y, month)}
                      className={`p-2 text-sm rounded-md transition-colors ${
                        y === year
                          ? 'bg-blue-500 text-white'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">月份</label>
                <div className="grid grid-cols-4 gap-1">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <button
                      key={m}
                      onClick={() => handleSelectMonth(year, m)}
                      className={`p-2 text-sm rounded-lg transition-colors ${
                        m === month
                          ? 'bg-blue-500 text-white'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {m}月
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 日历网格保持不变 */}
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