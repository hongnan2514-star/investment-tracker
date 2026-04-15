// components/ProfitInterpretation.tsx

import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Asset } from '@/src/constants/types';

// 定义资产昨日收益明细类型
interface AssetProfit {
  symbol: string;
  name: string;
  profit: number;
  changePercent: number;
}

interface ProfitInterpretationProps {
  userId: string;
  assets: Asset[];
  assetYesterdayProfits: AssetProfit[]; // ✅ 接收精确收益数据
  yesterdayProfit: number;
  weekProfit: number;
  weekReturnRate: number;
  currencySymbol: string;
  formatMoney: (num: number) => string;
  formatPercent: (num: number) => string;
}

export default function ProfitInterpretation({
  userId,
  assets,
  assetYesterdayProfits, // ✅ 解构新增 prop
  yesterdayProfit,
  weekProfit,
  weekReturnRate,
  currencySymbol,
  formatMoney,
  formatPercent,
}: ProfitInterpretationProps) {
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const getSign = (value: number) => (value > 0 ? '+' : value < 0 ? '-' : '');

  const getYesterdayStr = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  };

  const getCacheKey = () => `ai_analysis_${userId}_${getYesterdayStr()}`;

  const buildPrompt = () => {
    const profitDetails = assetYesterdayProfits
      .filter(p => Math.abs(p.profit) > 0.001) // 忽略微小变动
      .map(p => `${p.name}(${p.symbol}) 昨日收益 ${getSign(p.profit)}${currencySymbol}${formatMoney(Math.abs(p.profit))}，涨跌幅 ${p.changePercent.toFixed(2)}%`)
      .join('；');

    return `用户昨日总收益为 ${getSign(yesterdayProfit)}${currencySymbol}${formatMoney(Math.abs(yesterdayProfit))}。
各资产昨日表现如下（精确数据）：
${profitDetails}
请用简洁中文分析昨日盈亏的主要原因，指出贡献最大和拖累最大的资产。`;
  };

  const fetchAnalysis = async () => {
    const cacheKey = getCacheKey();
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setAiAnalysis(cached);
      return;
    }

    setLoading(true);
    setError(false);
    try {
      const prompt = buildPrompt();
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const analysis = data.analysis;
      setAiAnalysis(analysis);
      localStorage.setItem(cacheKey, analysis);
    } catch (err) {
      console.error('AI 分析失败', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId || assets.length === 0) return;
    fetchAnalysis();
  }, [userId, assets, yesterdayProfit]);

  const fallbackAnalysis = `根据历史数据，您的资产表现${weekReturnRate >= 0 ? '优于大盘' : '弱于大盘'}，建议关注波动较大的资产。`;

  return (
    <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 mb-4">
      <div className="flex items-start gap-2">
        <AlertCircle size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900 dark:text-blue-300 flex-1">
          <p className="font-medium">
            昨日收益 {getSign(yesterdayProfit)}{currencySymbol}
            {formatMoney(Math.abs(yesterdayProfit))}，本周累计{' '}
            {getSign(weekProfit)}{currencySymbol}
            {formatMoney(Math.abs(weekProfit))}，收益率{' '}
            {getSign(weekReturnRate)}{formatPercent(Math.abs(weekReturnRate))}%。
          </p >
          {loading ? (
            <div className="mt-2 flex items-center gap-1 text-gray-500">
              <Loader2 size={14} className="animate-spin" />
              <span>AI 正在分析昨日盈亏原因...</span>
            </div>
          ) : (
            <p className="mt-2">
              {error || !aiAnalysis ? fallbackAnalysis : aiAnalysis}
            </p >
          )}
        </div>
      </div>
    </div>
  );
}