"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, AlertCircle, Newspaper, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAssets } from '@/src/utils/assetStorage';
import { Asset } from '@/src/constants/types';
import { useCurrency, useCurrencyConverter } from '@/src/services/currency';
import { getCurrentUserId } from '@/src/utils/assetStorage';
import { eventBus } from '@/src/utils/eventBus';
import AIChatBox from '@/components/AIChatBox';

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

  // 获取快照历史并计算收益
  const fetchSnapshotHistory = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId) return;

    try {
      const period = '6M'; // 获取半年数据，足够日历使用
      const assets = getAssets();
      const res = await fetch('/api/snapshot/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, period, targetCurrency: currency, assets }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      let rawData: { timestamp: number; value: number }[] = json.data || [];

      // 按日期分组，取每天最后一个点（净值）
      const dailyNetWorth: { date: string; netWorth: number }[] = [];
      const map = new Map<string, number>();
      for (const point of rawData) {
        const date = new Date(point.timestamp).toISOString().split('T')[0];
        map.set(date, point.value);
      }
      const sortedDates = Array.from(map.keys()).sort();
      for (const date of sortedDates) {
        dailyNetWorth.push({ date, netWorth: map.get(date)! });
      }

      // 计算每日收益（当日净值 - 昨日净值）
      const returns: DailyReturn[] = [];
      for (let i = 1; i < dailyNetWorth.length; i++) {
        const today = dailyNetWorth[i];
        const yesterday = dailyNetWorth[i-1];
        const profit = today.netWorth - yesterday.netWorth;
        returns.push({ date: today.date, value: profit });
      }

      setDailyReturns(returns);

      // 昨日收益：最近一天（如果今天有快照，取今天与昨天差值；否则取最近两天）
      if (returns.length > 0) {
        const lastReturn = returns[returns.length - 1];
        setYesterdayProfit(lastReturn.value);
      } else {
        setYesterdayProfit(0);
      }

      // 本周收益：最近7天的收益累加
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekReturns = returns.filter(r => new Date(r.date) >= weekAgo);
      const weekSum = weekReturns.reduce((sum, r) => sum + r.value, 0);
      setWeekProfit(weekSum);

      // 近7天收益率：本周收益 / 7天前的净值
      const weekStartNetWorth = dailyNetWorth.find(d => d.date === weekAgo.toISOString().split('T')[0])?.netWorth;
      if (weekStartNetWorth && weekStartNetWorth !== 0) {
        setWeekReturnRate((weekSum / weekStartNetWorth) * 100);
      } else {
        setWeekReturnRate(0);
      }
    } catch (err) {
      console.error('获取快照数据失败', err);
    } finally {
      setLoading(false);
    }
  }, [currency]);

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
      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 shadow-md mb-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={20} className="text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">收益总览</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">昨日收益</p>
            <p className={`text-xl font-black ${yesterdayProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {yesterdayProfit >= 0 ? '+' : ''}{symbol}{formatMoney(Math.abs(yesterdayProfit))}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">本周收益</p>
            <p className={`text-xl font-black ${weekProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {weekProfit >= 0 ? '+' : ''}{symbol}{formatMoney(Math.abs(weekProfit))}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">近7天收益率</p>
            <p className={`text-xl font-black ${weekReturnRate >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {weekReturnRate >= 0 ? '+' : ''}{formatPercent(weekReturnRate)}%
            </p>
          </div>
        </div>
      </div>

      {/* 收益日历 */}
      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 shadow-md mb-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-gray-500 dark:text-gray-400" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">收益日历</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => changeMonth(-1)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-medium">
              {currentMonth.getFullYear()}年 {currentMonth.getMonth()+1}月
            </span>
            <button
              onClick={() => changeMonth(1)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 dark:text-gray-400 mb-2">
          {['日','一','二','三','四','五','六'].map(day => <div key={day}>{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {getCalendarDays().map((day, idx) => (
            <div
              key={idx}
              className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs ${
                day.profit !== undefined && day.profit !== null
                  ? day.profit >= 0
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                  : 'text-gray-300 dark:text-gray-600'
              }`}
            >
              <span className="font-bold">{day.date ? day.date.split('-')[2] : ''}</span>
              {day.profit !== undefined && day.profit !== null && (
                <span className="text-[10px]">
                  {day.profit >= 0 ? '+' : ''}{formatMoney(Math.abs(day.profit))}
                </span>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center">
          每日收益 = 当日净值 - 前日净值
        </p>
      </div>

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