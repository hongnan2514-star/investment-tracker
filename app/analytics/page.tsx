"use client";
// app/analytics/page.tsx
import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertCircle, Newspaper } from 'lucide-react';
import { getAssets } from '@/src/utils/assetStorage';
import { Asset } from '@/src/constants/types';
import AIChatBox from '@/components/AIChatBox';

export default function AnalyticsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [todayProfit, setTodayProfit] = useState(0);
  const [topGainers, setTopGainers] = useState<Asset[]>([]);
  const [topLosers, setTopLosers] = useState<Asset[]>([]);
  const [marketNews, setMarketNews] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userAssets = getAssets();
    setAssets(userAssets);

    if (userAssets.length > 0) {
      const total = userAssets.reduce((sum, a) => sum + a.marketValue, 0);
      const profit = userAssets.reduce((sum, a) => {
        return sum + a.price * a.holdings * (a.changePercent || 0) / 100;
      }, 0);
      setTotalValue(total);
      setTodayProfit(profit);

      const sorted = [...userAssets].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));
      setTopGainers(sorted.filter(a => (a.changePercent || 0) > 0).slice(0, 2));
      setTopLosers(sorted.filter(a => (a.changePercent || 0) < 0).slice(0, 2));

      setMarketNews([
        '美联储宣布维持利率不变，美股三大指数收涨',
        '比特币突破45000美元，创一个月新高',
        '苹果发布新款iPad，股价盘后上涨2%',
        '原油价格上涨带动能源板块走高',
        '特斯拉宣布裁员，股价下跌3%'
      ]);
    }

    setLoading(false);
  }, []);

  const formatMoney = (num: number) => {
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const generateInterpretation = () => {
    if (todayProfit > 0) {
      const gainers = topGainers.map(a => a.name).join('、');
      return `今日盈利 ${formatMoney(todayProfit)}，主要得益于 ${gainers} 的上涨。`;
    } else if (todayProfit < 0) {
      const losers = topLosers.map(a => a.name).join('、');
      return `今日亏损 ${formatMoney(Math.abs(todayProfit))}，主要受 ${losers} 下跌影响。`;
    } else {
      return `今日收益持平，市场整体波动较小。`;
    }
  };

  const generateUserContext = () => {
    if (assets.length === 0) return '';
    const holdings = assets.map(a => `${a.name}(${a.symbol}): ${a.holdings}份, 今日涨跌${a.changePercent?.toFixed(2)}%`).join('；');
    return `用户当前持仓：${holdings}。今日总收益：${todayProfit > 0 ? '+' : ''}${formatMoney(todayProfit)}。`;
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-black p-4 pb-24">
      <header className="mb-6 px-2">
        <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">AI分析</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">AI帮助您更加了解个人的财务状况</p>
      </header>

      {/* 资产概览 + 解读 */}
      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 shadow-md mb-4">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">总资产估值</span>
            <h2 className="text-3xl font-black text-gray-900 dark:text-gray-100 mt-1">
              ${formatMoney(totalValue)}
            </h2>
            <p className={`text-sm font-bold mt-2 ${todayProfit >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
              今日收益 {todayProfit >= 0 ? '+' : ''}{formatMoney(todayProfit)} 
              ({((todayProfit / totalValue) * 100 || 0).toFixed(2)}%)
            </p>
          </div>
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
            <TrendingUp size={32} className="text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        {/* AI 解读卡片 */}
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-2xl border border-blue-100 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <AlertCircle size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-900 dark:text-blue-300">
              {generateInterpretation()}
            </p>
          </div>
        </div>
      </div>

      {/* 消息面影响 */}
      {marketNews.length > 0 && (
        <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 shadow-md mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Newspaper size={20} className="text-gray-500 dark:text-gray-400" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">可能影响你资产的消息</h3>
          </div>
          <ul className="space-y-2">
            {marketNews.map((news, idx) => (
              <li key={idx} className="text-sm text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0">
                • {news}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 涨跌归因详情 */}
      {assets.length > 0 && (
        <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 shadow-md">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">今日详细分析</h3>
          
          {topGainers.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-bold text-green-600 dark:text-green-400 mb-2">📈 主要上涨资产</h4>
              {topGainers.map(asset => (
                <div key={asset.symbol} className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{asset.name}</span>
                  <span className="text-sm font-bold text-green-600 dark:text-green-400">
                    +{asset.changePercent?.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {topLosers.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-red-600 dark:text-red-400 mb-2">📉 主要下跌资产</h4>
              {topLosers.map(asset => (
                <div key={asset.symbol} className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{asset.name}</span>
                  <span className="text-sm font-bold text-red-600 dark:text-red-400">
                    {asset.changePercent?.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 底部固定 AI 聊天框 */}
      <div className="fixed bottom-16 left-0 right-0 px-4 z-50">
        <AIChatBox userContext={generateUserContext()} />
      </div>
    </main>
  );
}