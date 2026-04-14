// app/analytics/page.tsx

"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import { getAssets } from '@/src/utils/assetStorage';
import { Asset } from '@/src/constants/types';
import { useCurrency, useCurrencyConverter } from '@/src/services/currency';
import { getCurrentUserId } from '@/src/utils/assetStorage';
import { eventBus } from '@/src/utils/eventBus';
import AIChatBox from '@/components/AIChatBox';
import ProfitOverview from '@/components/ProfitOverview';
import ProfitCalendar from '@/components/ProfitCalendar';
import ProfitOverviewSkeleton from '@/components/analytics/ProfitOverviewSkeleton';
import AICardSkeleton from '@/components/analytics/AICardSkeleton';
import ProfitCalendarSkeleton from '@/components/analytics/ProfitCalendarSkeleton';

type Period = 'day' | 'week' | 'month' | 'year';

interface DailyReturn {
  date: string;
  value: number;
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
  const [convertedYesterdayProfit, setConvertedYesterdayProfit] = useState(0);
  const [convertedWeekProfit, setConvertedWeekProfit] = useState(0);
  const [convertedTotalValue, setConvertedTotalValue] = useState(0);

  const { currency, symbol } = useCurrency();
  const { convert, loading: converting } = useCurrencyConverter();
  const [convertedDailyReturns, setConvertedDailyReturns] = useState<DailyReturn[]>([]);

  const [loadingMidnight, setLoadingMidnight] = useState(true);
  const [loadingTotalValue, setLoadingTotalValue] = useState(true);
  const [loadingCalendar, setLoadingCalendar] = useState(true);

const fetchMidnightValues = useCallback(async () => {
  setLoadingMidnight(true);
  const userId = getCurrentUserId();
  if (!userId) {
    setLoadingMidnight(false);
    return;
  }

  try {
    const calendarRes = await fetch('/api/snapshot/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const calendarData = await calendarRes.json();
    if (!calendarData.success) throw new Error(calendarData.error || 'Failed to fetch calendar data');

    const returns: DailyReturn[] = calendarData.data || [];

    // 昨日收益
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const yesterdayReturn = returns.find(r => r.date === yesterdayStr);
    const rawYesterdayProfit = yesterdayReturn ? yesterdayReturn.value : 0;

    // 本周收益：最近 7 个有数据的日收益之和
    const sortedReturns = [...returns].sort((a, b) => b.date.localeCompare(a.date));
    const last7Returns = sortedReturns.slice(0, 7);
    const rawWeekProfit = last7Returns.reduce((sum, r) => sum + r.value, 0);

    // 获取 7 天前的净值以计算收益率
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    let rawWeekReturnRate = 0;
    try {
      const res = await fetch(`/api/snapshot/midnight?userId=${userId}&date=${sevenDaysAgoStr}`);
      const data = await res.json();
      const baseNetWorth = data.netWorth;
      if (baseNetWorth && baseNetWorth !== 0) {
        rawWeekReturnRate = (rawWeekProfit / baseNetWorth) * 100;
      }
    } catch (err) {
      console.warn('获取 7 天前净值失败，收益率设为 0', err);
    }

    setYesterdayProfit(rawYesterdayProfit);
    setWeekProfit(rawWeekProfit);
    setWeekReturnRate(rawWeekReturnRate);

    const convertedYesterday = await convert(rawYesterdayProfit, 'CNY', currency);
    const convertedWeek = await convert(rawWeekProfit, 'CNY', currency);
    setConvertedYesterdayProfit(convertedYesterday);
    setConvertedWeekProfit(convertedWeek);
  } catch (error) {
    console.error('获取收益数据失败', error);
  } finally {
    setLoadingMidnight(false);
  }
}, [currency, convert]);

  useEffect(() => {
    fetchMidnightValues();
  }, [fetchMidnightValues]);

  useEffect(() => {
    const convertDailyReturns = async () => {
      if (dailyReturns.length === 0) {
        setConvertedDailyReturns([]);
        return;
      }
      const converted = await Promise.all(
        dailyReturns.map(async (item) => ({
          date: item.date,
          value: await convert(item.value, 'CNY', currency),
        }))
      );
      setConvertedDailyReturns(converted);
    };
    convertDailyReturns();
  }, [dailyReturns, currency, convert]);

  const fetchSnapshotHistory = useCallback(async () => {
    setLoadingCalendar(true);
    const userId = getCurrentUserId();
    if (!userId) {
      setLoadingCalendar(false);
      return;
    }
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
      setLoadingCalendar(false);
    }
  }, []);

  useEffect(() => {
    const convertProfits = async () => {
      if (yesterdayProfit !== 0 || weekProfit !== 0) {
        const convertedYesterday = await convert(yesterdayProfit, 'CNY', currency);
        const convertedWeek = await convert(weekProfit, 'CNY', currency);
        setConvertedYesterdayProfit(convertedYesterday);
        setConvertedWeekProfit(convertedWeek);
      }
    };
    convertProfits();
  }, [currency, convert, yesterdayProfit, weekProfit]);

  const fetchTotalValue = useCallback(async () => {
    setLoadingTotalValue(true);
    const assets = getAssets();
    let total = 0;
    for (const asset of assets) {
      const fromCurrency = asset.currency || 'USD';
      const value = await convert(asset.marketValue, fromCurrency as any, currency);
      total += value;
    }
    setTotalValue(total);
    setConvertedTotalValue(total);
    setLoadingTotalValue(false);
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

  const changeMonth = (delta: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1));
  };

  const generateUserContext = () => {
    if (assets.length === 0) return '';
    const holdings = assets.map(a => `${a.name}(${a.symbol}): ${a.holdings}份, 今日涨跌${a.changePercent?.toFixed(2)}%`).join('；');
    return `用户当前持仓：${holdings}。昨日收益：${formatMoney(convertedYesterdayProfit)}，本周收益：${formatMoney(convertedWeekProfit)}，本周收益率：${formatPercent(weekReturnRate)}%。`;
  };

  const isPageLoading = loadingMidnight || loadingTotalValue || loadingCalendar || converting;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-black p-4 pb-24">
      <header className="mb-6 px-2">
        <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">AI分析</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">AI帮助您更加了解个人的财务状况</p>
      </header>

      {isPageLoading ? (
        <>
          <ProfitOverviewSkeleton />
          <AICardSkeleton />
          <ProfitCalendarSkeleton />
        </>
      ) : (
        <>
          <ProfitOverview
            yesterdayProfit={convertedYesterdayProfit}
            weekProfit={convertedWeekProfit}
            weekReturnRate={weekReturnRate}
            currencySymbol={symbol}
          />

          <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 shadow-md mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 dark:text-blue-300">
                <p>昨日收益 {convertedYesterdayProfit >= 0 ? '+' : ''}{symbol}{formatMoney(Math.abs(convertedYesterdayProfit))}，本周累计 {convertedWeekProfit >= 0 ? '+' : ''}{symbol}{formatMoney(Math.abs(convertedWeekProfit))}，收益率 {weekReturnRate >= 0 ? '+' : ''}{formatPercent(weekReturnRate)}%。</p>
                <p className="mt-1">根据历史数据，您的资产表现{weekReturnRate >= 0 ? '优于大盘' : '弱于大盘'}，建议关注波动较大的资产。</p>
              </div>
            </div>
          </div>

          <ProfitCalendar
            dailyReturns={convertedDailyReturns}
            currentMonth={currentMonth}
            onMonthChange={changeMonth}
            formatMoney={formatMoney}
          />
        </>
      )}

      <div className="fixed bottom-16 left-0 right-0 px-4 z-50">
        <AIChatBox userContext={generateUserContext()} />
      </div>
    </main>
  );
}