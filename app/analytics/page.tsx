// app/analytics/page.tsx

"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, AlertCircle, Newspaper, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAssets } from '@/src/utils/assetStorage';
import { Asset } from '@/src/constants/types';
import { useCurrency, useCurrencyConverter } from '@/src/services/currency';
import { getCurrentUserId } from '@/src/utils/assetStorage';
import { eventBus } from '@/src/utils/eventBus';
import AIChatBox from '@/components/AIChatBox';
import ProfitOverview from '@/components/ProfitOverview';
import ProfitCalendar from '@/components/ProfitCalendar';

type Period = 'day' | 'week' | 'month' | 'year';

interface DailyReturn {
  date: string;       // YYYY-MM-DD
  value: number;      // 当日收益（用户当前货币）
}

export default function AnalyticsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [yesterdayProfit, setYesterdayProfit] = useState(0);
  const [weekProfit, setWeekProfit] = useState(0);
  const [weekReturnRate, setWeekReturnRate] = useState(0);
  const [dailyReturns, setDailyReturns] = useState<DailyReturn[]>([]);
  const [calendarPeriod, setCalendarPeriod] = useState<Period>('day');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const { currency, symbol } = useCurrency();
  const { convert, loading: converting } = useCurrencyConverter();

const [todayMidnightValue, setTodayMidnightValue] = useState<number | null>(null);
const [yesterdayMidnightValue, setYesterdayMidnightValue] = useState<number | null>(null);

const fetchMidnightValues = useCallback(async () => {
  const userId = getCurrentUserId();
  if (!userId) return;

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  // 获取今日、昨日、7天前快照
  const [todayRes, yesterdayRes] = await Promise.all([
    fetch(`/api/snapshot/midnight?userId=${userId}&date=${formatDate(today)}`),
    fetch(`/api/snapshot/midnight?userId=${userId}&date=${formatDate(yesterday)}`),
  ]);

  const todayData = await todayRes.json();
  const yesterdayData = await yesterdayRes.json();
  const todayVal = todayData.netWorth;
  const yesterdayVal = yesterdayData.netWorth;

  // 寻找实际可用的“7天前”快照（若不存在则向前回溯）
  let actualSevenDaysVal = null;
  let attemptDate = new Date(sevenDaysAgo);
  const maxAttempts = 30; // 最多向前回溯30天，避免无限循环
  let attempts = 0;

  while (actualSevenDaysVal === null && attempts < maxAttempts) {
    const dateStr = formatDate(attemptDate);
    const res = await fetch(`/api/snapshot/midnight?userId=${userId}&date=${dateStr}`);
    const data = await res.json();
    if (data.netWorth !== null) {
      actualSevenDaysVal = data.netWorth;
      break;
    }
    attemptDate.setDate(attemptDate.getDate() - 1); // 向前推一天
    attempts++;
  }

  // 昨日收益
  if (todayVal !== null && yesterdayVal !== null) {
    setYesterdayProfit(todayVal - yesterdayVal);
  } else {
    setYesterdayProfit(0);
  }

  // 本周收益 & 收益率（使用实际找到的快照）
  if (todayVal !== null && actualSevenDaysVal !== null) {
    const profit = todayVal - actualSevenDaysVal;
    setWeekProfit(profit);
    if (actualSevenDaysVal !== 0) {
      setWeekReturnRate((profit / actualSevenDaysVal) * 100);
    } else {
      setWeekReturnRate(0);
    }
  } else {
    setWeekProfit(0);
    setWeekReturnRate(0);
  }
}, []);

useEffect(() => {
  fetchMidnightValues();
}, [fetchMidnightValues]);

  // 获取快照历史并计算收益
const fetchSnapshotHistory = useCallback(async () => {
  const userId = getCurrentUserId();
  if (!userId) return;
  try {
    const res = await fetch('/api/snapshot/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    setDailyReturns(json.data || []);
  } catch (err) {
    console.error('获取收益日历失败', err);
    setDailyReturns([]);
  } finally {
    setLoading(false);
  }
}, []);

  // 获取资产总价值（用于AI上下文）
  const fetchTotalValue = useCallback(async () => {
    const assets = getAssets();
    let total = 0;
    for (const asset of assets) {
      const fromCurrency = asset.currency || 'USD';
      const value = await convert(asset.marketValue, fromCurrency as any, currency);
      total += value;
    }
    setTotalValue(total);
  }, [currency, convert]);

  useEffect(() => {
    fetchSnapshotHistory();
    fetchTotalValue();

    const handleAssetsUpdate = () => {
      fetchSnapshotHistory();
      fetchTotalValue();
    };
    const unsubscribe = eventBus.subscribe('assetsUpdated', handleAssetsUpdate);
    return () => unsubscribe();
  }, [fetchSnapshotHistory, fetchTotalValue]);

  const formatMoney = (num: number) => {
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPercent = (num: number) => {
    return num.toFixed(2);
  };

  // 收益日历数据生成
  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startWeekday = firstDay.getDay(); // 0=周日

    const days: { date: string; profit: number | null }[] = [];
    // 填充空白
    for (let i = 0; i < startWeekday; i++) {
      days.push({ date: '', profit: null });
    }
    // 填充当月日期
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const profit = dailyReturns.find(r => r.date === dateStr)?.value || null;
      days.push({ date: dateStr, profit });
    }
    return days;
  };

  const changeMonth = (delta: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1));
  };

  // 生成AI解读上下文
  const generateUserContext = () => {
    if (assets.length === 0) return '';
    const holdings = assets.map(a => `${a.name}(${a.symbol}): ${a.holdings}份, 今日涨跌${a.changePercent?.toFixed(2)}%`).join('；');
    return `用户当前持仓：${holdings}。昨日收益：${formatMoney(yesterdayProfit)}，本周收益：${formatMoney(weekProfit)}，本周收益率：${formatPercent(weekReturnRate)}%。`;
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-black p-4 pb-24">
      <header className="mb-6 px-2">
        <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">AI分析</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">AI帮助您更加了解个人的财务状况</p>
      </header>

      {/* 收益总览卡片 */}
<ProfitOverview
  yesterdayProfit={yesterdayProfit}
  weekProfit={weekProfit}
  weekReturnRate={weekReturnRate}
  currencySymbol={symbol}
/>

<ProfitCalendar
  dailyReturns={dailyReturns}
  currentMonth={currentMonth}
  onMonthChange={changeMonth}
  formatMoney={formatMoney}
/>

      {/* AI 解读卡片 */}
      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 shadow-md mb-4">
        <div className="flex items-start gap-2">
          <AlertCircle size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 dark:text-blue-300">
            <p>昨日收益 {yesterdayProfit >= 0 ? '+' : ''}{symbol}{formatMoney(Math.abs(yesterdayProfit))}，本周累计 {weekProfit >= 0 ? '+' : ''}{symbol}{formatMoney(Math.abs(weekProfit))}，收益率 {weekReturnRate >= 0 ? '+' : ''}{formatPercent(weekReturnRate)}%。</p>
            <p className="mt-1">根据历史数据，您的资产表现{weekReturnRate >= 0 ? '优于大盘' : '弱于大盘'}，建议关注波动较大的资产。</p>
          </div>
        </div>
      </div>

      {/* 底部固定 AI 聊天框 */}
      <div className="fixed bottom-16 left-0 right-0 px-4 z-50">
        <AIChatBox userContext={generateUserContext()} />
      </div>
    </main>
  );
}