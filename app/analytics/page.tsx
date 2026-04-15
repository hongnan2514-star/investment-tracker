// app/analytics/page.tsx

"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, MessageCircle } from 'lucide-react';
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
import FullScreenChat from '@/components/FullScreenChat';
import ProfitInterpretation from '@/components/ProfitInterpretation';

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
  const [isChatOpen, setIsChatOpen] = useState(false);

  const [loadingMidnight, setLoadingMidnight] = useState(true);
  const [loadingTotalValue, setLoadingTotalValue] = useState(true);
  const [loadingCalendar, setLoadingCalendar] = useState(true);

  interface AssetProfit {
  symbol: string;
  name: string;
  profit: number;
  changePercent: number;
}

const [assetYesterdayProfits, setAssetYesterdayProfits] = useState<AssetProfit[]>([]);

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
  if (!assets.length) return;
  const profits = assets.map(asset => {
    const close = asset.yesterday_close_value ?? asset.marketValue; // ✅ 改为 marketValue
    const profit = asset.marketValue - close;
    const changePercent = close !== 0 ? (profit / close) * 100 : 0;
    return {
      symbol: asset.symbol,
      name: asset.name,
      profit,
      changePercent,
    };
  });
  setAssetYesterdayProfits(profits);
}, [assets]);

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

  const handleSetMonth = useCallback((year: number, month: number) => {
  setCurrentMonth(new Date(year, month, 1));
  }, []);

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
  const currentAssets = getAssets();
  setAssets(currentAssets);
  let total = 0;
  for (const asset of currentAssets) {
    const fromCurrency = asset.currency || 'USD';
    const value = await convert(asset.marketValue, fromCurrency as any, currency);
    total += value;
  }
  setTotalValue(total);
  setConvertedTotalValue(total);
  setLoadingTotalValue(false);
}, [currency, convert]);

useEffect(() => {
  const initialAssets = getAssets();
  setAssets(initialAssets);
  fetchSnapshotHistory();
  fetchTotalValue();

  const handleAssetsUpdate = () => {
    const updatedAssets = getAssets();
    setAssets(updatedAssets);
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
      {/* 头部：标题 + 右侧聊天按钮 */}
      <header className="mb-6 px-2 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">AI分析</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">AI帮助您更加了解个人的财务状况</p >
        </div>
        <button
          onClick={() => setIsChatOpen(true)}
          className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          aria-label="打开AI对话"
        >
          <MessageCircle size={22} className="text-gray-700 dark:text-gray-300" />
        </button>
      </header>

      {/* 其余内容与之前完全相同 */}
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

<ProfitInterpretation
  userId={getCurrentUserId() || ''}
  assets={assets}
  assetYesterdayProfits={assetYesterdayProfits}
  yesterdayProfit={convertedYesterdayProfit}
  weekProfit={convertedWeekProfit}
  weekReturnRate={weekReturnRate}
  currencySymbol={symbol}
  formatMoney={formatMoney}
  formatPercent={formatPercent}
/>

<ProfitCalendar
  dailyReturns={convertedDailyReturns}
  currentMonth={currentMonth}
  onMonthChange={changeMonth}
  onSetMonth={handleSetMonth}
  formatMoney={formatMoney}
/>
        </>
      )}

      {/* 全屏聊天组件，根据状态显示 */}
      {isChatOpen && (
        <FullScreenChat
          initialMessages={[]}
          userContext={generateUserContext()}
          onClose={() => setIsChatOpen(false)}
        />
      )}
    </main>
  );
}